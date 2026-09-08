const API_URL = "http://127.0.0.1:8000";

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

export async function fetchDashboardSummary() {
  const response = await fetch(`${API_URL}/companies/dashboard-summary`);

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard summary");
  }

  return await response.json();
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

  const response = await fetch(`${API_URL}/companies/?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    console.error("Companies API Error:", text);
    throw new Error(`Failed to fetch companies (${response.status})`);
  }

  const data = await response.json();

  return {
    page: data.page,
    total: data.total,
    results: data.results.map((company: any) => ({
      id: company.id,
      company_name: company.company_name,
      symbol: company.symbol,
      exchange: company.exchange,
      sector: company.sector ?? "Unknown",
      market_cap: company.market_cap ?? "Unknown",
      listing_status: company.listing_status,
      ai_score: company.ai_score ?? 0,
    })),
  };
}
import { QuarterlyResult } from "@/types/result";

const API_BASE = "http://127.0.0.1:8000";

export async function fetchQuarterlyResults(): Promise<QuarterlyResult[]> {
  const response = await fetch(`${API_BASE}/companies`);

  if (!response.ok) {
    throw new Error("Failed to fetch companies.");
  }

  const companies = await response.json();

  return companies.map((company: any) => ({
    company: company.company,
    sector: company.sector,
    marketCap: company.market_cap,
    revenueGrowth: company.revenue_growth,
    patGrowth: company.pat_growth,
    roce: company.roce,
    score: company.ai_score,
  }));
}
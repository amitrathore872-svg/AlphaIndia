import { QuarterlyResult } from "@/types/result";

const API_BASE = "http://127.0.0.1:8000";

export async function fetchQuarterlyResults(): Promise<QuarterlyResult[]> {
  const response = await fetch(`${API_BASE}/companies`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to connect to Alpha India API.");
  }

  const data = await response.json();

  return data.companies.map((company: any) => ({
    company: company.company,
    sector: company.sector,
    marketCap: company.market_cap,
    revenueGrowth: company.revenue_growth,
    patGrowth: company.pat_growth,
    roce: company.roce,
    score: company.ai_score,
  }));
}
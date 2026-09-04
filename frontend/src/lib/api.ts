export type GrowthCompany = {
  company: string;
  symbol: string;
  sector: string;
  quarter: string;
  resultDate: string;
  revenueGrowth: number;
  patGrowth: number;
  roce: number;
  growthScore: number;
};

const API = "http://127.0.0.1:8000";

export async function fetchGrowthCompanies(): Promise<GrowthCompany[]> {
  const response = await fetch(`${API}/growth-screener`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Unable to connect to Alpha India API.");
  }

  return response.json();
}
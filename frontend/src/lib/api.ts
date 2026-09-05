import type { DashboardSummary, GrowthScreenerParams, GrowthScreenerResponse } from "@/types/growth";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
async function getJson<T>(path: string): Promise<T> { const response = await fetch(`${API_URL}${path}`, { cache: "no-store" }); if (!response.ok) throw new Error("Unable to connect to Alpha India API."); return response.json() as Promise<T>; }
export async function fetchGrowthCompanies(params: GrowthScreenerParams = {}): Promise<GrowthScreenerResponse> { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); }); return getJson<GrowthScreenerResponse>(`/growth-screener${query.size ? `?${query}` : ""}`); }
export function fetchDashboardSummary(): Promise<DashboardSummary> { return getJson<DashboardSummary>("/dashboard-summary"); }

import { QuarterlyResult } from "@/types/result";

const API_BASE = "http://127.0.0.1:8000";

export async function fetchQuarterlyResults(): Promise<QuarterlyResult[]> {
  const response = await fetch(`${API_BASE}/results`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch quarterly results");
  }

  return response.json();
}
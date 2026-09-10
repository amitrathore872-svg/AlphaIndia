const API_BASE = "http://127.0.0.1:8000";

export interface ImportDashboardSummary {
  total_companies: number;
  imported_companies: number;
  progress_percent: number;

  filings_discovered: number;
  pdf_downloaded: number;
  pending_downloads: number;
  parsed_filings: number;

  ai_scores_generated: number;
}

export async function fetchImportDashboardSummary(): Promise<ImportDashboardSummary> {
  const response = await fetch(`${API_BASE}/import-dashboard/summary`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Mission Control summary.");
  }

  return response.json();
}
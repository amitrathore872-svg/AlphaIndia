// =====================================================
// Alpha India API Service
// Version: v0.9.2
// Sprint: 4 Stabilization
// =====================================================

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// -----------------------------------------------------
// Types
// -----------------------------------------------------

export interface DashboardSummary {
  total_companies: number;
  active_companies: number;
  nse_companies: number;
  bse_companies: number;
}

export interface Company {
  id: number;
  company_name: string;
  symbol: string;
  exchange: "NSE" | "BSE" | "BOTH";
  bse_code: string;
  isin: string;
  sector: string;
  market_cap: number | string;
  listing_status: string;
  ai_score: number;
}

export interface CompanyResponse {
  page: number;
  limit: number;
  total: number;
  results: Company[];
}

// -----------------------------------------------------
// Dashboard Summary
// -----------------------------------------------------

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  try {
    const response = await fetch(
      `${API_BASE}/companies/dashboard-summary`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(
        "Dashboard Summary API Error:",
        response.status,
        text
      );

      return {
        total_companies: 0,
        active_companies: 0,
        nse_companies: 0,
        bse_companies: 0,
      };
    }

    return await response.json();
  } catch (error) {
    console.error("Dashboard Summary Fetch Failed:", error);

    return {
      total_companies: 0,
      active_companies: 0,
      nse_companies: 0,
      bse_companies: 0,
    };
  }
}

// -----------------------------------------------------
// Companies List (Pagination + Search)
// -----------------------------------------------------

export async function fetchCompanies(
  page: number = 1,
  limit: number = 25,
  search: string = ""
): Promise<CompanyResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search,
  });

  try {
    const response = await fetch(
      `${API_BASE}/companies/?${params.toString()}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text = await response.text();

      console.error("Companies API Error:", {
        status: response.status,
        body: text,
      });

      throw new Error(`Failed to fetch companies (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.error("Companies Fetch Failed:", error);

    return {
      page: 1,
      limit,
      total: 0,
      results: [],
    };
  }
}

// -----------------------------------------------------
// Monitoring Status API
// -----------------------------------------------------

export async function fetchMonitoringStatus() {
  const response = await fetch(
    `${API_BASE}/system/status`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch monitoring status");
  }

  return await response.json();
}

// -----------------------------------------------------
// Monitoring Heartbeat API
// -----------------------------------------------------

export async function fetchHeartbeat() {
  const response = await fetch(
    `${API_BASE}/system/heartbeat`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch heartbeat");
  }

  return await response.json();
}

// -----------------------------------------------------
// Monitoring Settings API
// -----------------------------------------------------

export async function fetchMonitoringSettings() {
  const response = await fetch(
    `${API_BASE}/system/settings`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch monitoring settings");
  }

  return await response.json();
}

export async function updateMonitoringSetting(
  key: string,
  value: string
) {
  const response = await fetch(
    `${API_BASE}/system/settings/${key}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        setting_value: value,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update setting: ${key}`);
  }

  return await response.json();
}
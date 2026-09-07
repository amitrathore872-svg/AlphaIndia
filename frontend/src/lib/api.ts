

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// -------------------------------------------------
// Companies API
// -------------------------------------------------
export async function fetchCompanies(
  search = "",
  page = 1,
  limit = 50
) {
  const offset = (page - 1) * limit;

  const response = await fetch(
    `${API_BASE}/companies?search=${encodeURIComponent(
      search
    )}&limit=${limit}&offset=${offset}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch companies");
  }

  return response.json();
}

// -------------------------------------------------
// Dashboard Summary API
// -------------------------------------------------
export async function fetchDashboardSummary() {
  const response = await fetch(`${API_BASE}/dashboard-summary`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard summary");
  }

  return response.json();
}
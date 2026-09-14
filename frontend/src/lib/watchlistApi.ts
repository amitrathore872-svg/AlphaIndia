// =======================================================
// Alpha India Watchlist API Client
// Multi-Watchlist, Stock Search, Conviction Updating & Inline Comments
// =======================================================

import type {
  WatchlistSummary,
  WatchlistDetailResponse,
  StockSearchResult,
  CreateWatchlistPayload,
  AddStockPayload,
  UpdateStockPayload,
  WatchlistItem,
} from "@/types/watchlist";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errJson = await res.json();
      if (errJson.detail) errorDetail = errJson.detail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export async function fetchWatchlists(): Promise<{
  success: boolean;
  count: number;
  watchlists: WatchlistSummary[];
}> {
  return request("/watchlists");
}

export async function fetchWatchlist(
  watchlistId: number
): Promise<WatchlistDetailResponse> {
  return request(`/watchlists/${watchlistId}`);
}

export async function createWatchlist(
  payload: CreateWatchlistPayload
): Promise<{
  success: boolean;
  message: string;
  watchlist: WatchlistSummary;
}> {
  return request("/watchlists", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWatchlist(
  watchlistId: number,
  payload: Partial<CreateWatchlistPayload>
): Promise<{
  success: boolean;
  message: string;
  watchlist: Partial<WatchlistSummary>;
}> {
  return request(`/watchlists/${watchlistId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWatchlist(
  watchlistId: number
): Promise<{ success: boolean; message: string }> {
  return request(`/watchlists/${watchlistId}`, {
    method: "DELETE",
  });
}

export async function searchStocksForWatchlist(
  query: string,
  limit = 15
): Promise<StockSearchResult[]> {
  if (!query.trim()) return [];
  const res = await request<{
    success: boolean;
    count: number;
    results: StockSearchResult[];
  }>(`/watchlists/search/stocks?q=${encodeURIComponent(query)}&limit=${limit}`);
  return res.results || [];
}

export async function addStockToWatchlist(
  watchlistId: number,
  payload: AddStockPayload
): Promise<{
  success: boolean;
  message: string;
  item: WatchlistItem;
}> {
  return request(`/watchlists/${watchlistId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStockInWatchlist(
  watchlistId: number,
  itemId: number,
  payload: UpdateStockPayload
): Promise<{
  success: boolean;
  message: string;
  item: WatchlistItem;
}> {
  return request(`/watchlists/${watchlistId}/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function removeStockFromWatchlist(
  watchlistId: number,
  itemId: number
): Promise<{
  success: boolean;
  message: string;
  removed_symbol: string;
}> {
  return request(`/watchlists/${watchlistId}/items/${itemId}`, {
    method: "DELETE",
  });
}

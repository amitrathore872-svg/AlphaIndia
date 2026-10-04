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

import { API_BASE } from "@/lib/apiConfig";


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

// =========================================================
// Watchlist Rule Alerts & Personal Telegram Broadcast API
// =========================================================

export async function fetchPersonalTelegramConfig(): Promise<{
  success: boolean;
  config: import("@/types/watchlist").PersonalTelegramConfig;
}> {
  return request("/watchlists/personal-telegram/config");
}

export async function updatePersonalTelegramConfig(
  payload: import("@/types/watchlist").UpdatePersonalTelegramPayload
): Promise<{
  success: boolean;
  message: string;
  config: import("@/types/watchlist").PersonalTelegramConfig;
}> {
  return request("/watchlists/personal-telegram/config", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function testPersonalTelegramPing(payload?: {
  chat_id?: string;
  bot_token?: string;
}): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  return request("/watchlists/personal-telegram/test-ping", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function fetchAlertsForSymbol(
  symbol: string
): Promise<{
  success: boolean;
  symbol: string;
  alerts: import("@/types/watchlist").WatchlistAlertItem[];
}> {
  return request(`/watchlists/alerts/by-symbol/${encodeURIComponent(symbol)}`);
}

export async function fetchAlertsForWatchlist(
  watchlistId: number
): Promise<{
  success: boolean;
  watchlist_id: number;
  alerts: import("@/types/watchlist").WatchlistAlertItem[];
}> {
  return request(`/watchlists/${watchlistId}/alerts`);
}

export async function fetchAllActiveAlerts(params?: {
  target_scope?: string;
  status?: string;
  signal_direction?: string;
  rule_type?: string;
}): Promise<{
  success: boolean;
  count: number;
  alerts: import("@/types/watchlist").WatchlistAlertItem[];
  summary: import("@/types/watchlist").AlertsOverviewSummary;
}> {
  const q = new URLSearchParams();
  if (params?.target_scope && params.target_scope !== "ALL") q.append("target_scope", params.target_scope);
  if (params?.status && params.status !== "ALL") q.append("status", params.status);
  if (params?.signal_direction && params.signal_direction !== "ALL") q.append("signal_direction", params.signal_direction);
  if (params?.rule_type) q.append("rule_type", params.rule_type);
  const queryStr = q.toString() ? `?${q.toString()}` : "";
  return request(`/watchlists/alerts/all${queryStr}`);
}

export async function createUnifiedAlert(
  payload: import("@/types/watchlist").CreateUnifiedAlertPayload
): Promise<{
  success: boolean;
  message: string;
  alert: import("@/types/watchlist").WatchlistAlertItem;
}> {
  return request("/watchlists/alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createWatchlistAlert(
  watchlistId: number,
  payload: import("@/types/watchlist").CreateWatchlistAlertPayload
): Promise<{
  success: boolean;
  message: string;
  alert: import("@/types/watchlist").WatchlistAlertItem;
}> {
  return request(`/watchlists/${watchlistId}/alerts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAlertStatus(
  alertId: number,
  status: "ACTIVE" | "TRIGGERED" | "SNOOZED" | "MUTED"
): Promise<{
  success: boolean;
  message: string;
  alert: import("@/types/watchlist").WatchlistAlertItem;
}> {
  return request(`/watchlists/alerts/${alertId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteWatchlistAlert(
  alertId: number
): Promise<{
  success: boolean;
  message: string;
}> {
  return request(`/watchlists/alerts/${alertId}`, {
    method: "DELETE",
  });
}

export async function evaluateSymbolAlerts(
  symbol: string,
  metrics: {
    cmp: number;
    day_change_pct?: number;
    volume?: number;
    avg_volume_20d?: number;
    dma_9?: number;
    dma_20?: number;
    dma_50?: number;
    dma_200?: number;
    supertrend_direction?: string;
    supertrend_val?: number;
    vcp_score?: number;
    momentum_matches?: number;
    delivery_pct?: number;
  }
): Promise<{
  success: boolean;
  symbol: string;
  triggered_count: number;
  triggered: any[];
}> {
  return request(`/watchlists/alerts/evaluate/${encodeURIComponent(symbol)}`, {
    method: "POST",
    body: JSON.stringify(metrics),
  });
}


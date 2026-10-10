// =======================================================
// Alpha India — Earnings Calendar Client API
// =======================================================

import { fetchJson } from "./apiConfig";

export interface EarningsCalendarItem {
  id: number;
  company_id?: number | null;
  symbol: string;
  company_name: string;
  exchange: string;
  meeting_date: string;
  fiscal_period?: string | null;
  purpose: string;
  status: "SCHEDULED" | "TODAY" | "COMPLETED" | "UNSCHEDULED_SURPRISE" | "PAST_DUE";
  details?: string | null;
  reported_at?: string | null;
  result_filing_id?: number | null;
}

export interface CalendarStatsResponse {
  status: string;
  today: string;
  stats: {
    total_tracked: number;
    upcoming_next_14d: number;
    due_today: number;
    completed_reconciled: number;
    unscheduled_surprises: number;
  };
}

export interface TodaysCalendarResponse {
  status: string;
  date: string;
  summary: {
    total_expected: number;
    total_reported: number;
    total_surprises: number;
  };
  results: EarningsCalendarItem[];
}

export interface UpcomingCalendarResponse {
  status: string;
  days_ahead: number;
  count: number;
  results: EarningsCalendarItem[];
}

export async function fetchCalendarStats(): Promise<CalendarStatsResponse | null> {
  try {
    return await fetchJson<CalendarStatsResponse>("/api/earnings-calendar/stats");
  } catch (err) {
    console.warn("[EarningsCalendarApi] Failed to fetch stats (backend may be starting or offline):", err);
    return null;
  }
}

export async function fetchUpcomingEarnings(daysAhead: number = 14, limit: number = 100): Promise<UpcomingCalendarResponse | null> {
  try {
    return await fetchJson<UpcomingCalendarResponse>(
      `/api/earnings-calendar/upcoming?days_ahead=${daysAhead}&limit=${limit}`
    );
  } catch (err) {
    console.warn("[EarningsCalendarApi] Failed to fetch upcoming calendar:", err);
    return null;
  }
}

export async function fetchTodaysEarnings(): Promise<TodaysCalendarResponse | null> {
  try {
    return await fetchJson<TodaysCalendarResponse>("/api/earnings-calendar/today");
  } catch (err) {
    console.warn("[EarningsCalendarApi] Failed to fetch today's earnings:", err);
    return null;
  }
}

export async function triggerCalendarSync(): Promise<{ status: string; synced_new?: number; updated_existing?: number } | null> {
  try {
    return await fetchJson<{ status: string; synced_new?: number; updated_existing?: number }>(
      "/api/earnings-calendar/sync",
      { method: "POST" }
    );
  } catch (err) {
    console.warn("[EarningsCalendarApi] Failed to trigger sync:", err);
    return null;
  }
}

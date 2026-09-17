import { getBackendUrl } from "./apiConfig";

export interface ControlSystemServiceItem {
  id: string;
  name: string;
  category: string;
  status: "RUNNING" | "POLLING" | "IDLE" | "PAUSED" | "ERROR";
  poll_interval_seconds: number;
  last_fetch_time: string | null;
  next_run_time: string | null;
  total_fetches: number;
  records_ingested_today: number;
  last_status: string;
  last_error: string | null;
  description: string;
}

export interface ActionLogItem {
  id: number;
  timestamp: string;
  service_id: string;
  service_name: string;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  action: string;
  message: string;
  duration_ms: number;
  records_count: number;
}

export interface ControlSystemStatusResponse {
  server_time: string;
  total_services: number;
  active_services: number;
  total_records_ingested_today: number;
  latest_fetch_time: string | null;
  services: ControlSystemServiceItem[];
  recent_logs: ActionLogItem[];
}

export async function fetchControlSystemStatus(): Promise<ControlSystemStatusResponse> {
  const res = await fetch(`${getBackendUrl()}/control-system/status`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch control system status: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchControlSystemLogs(
  serviceId?: string,
  level?: string,
  limit = 50
): Promise<ActionLogItem[]> {
  const params = new URLSearchParams();
  if (serviceId && serviceId !== "ALL") params.append("service_id", serviceId);
  if (level && level !== "ALL") params.append("level", level);
  params.append("limit", String(limit));

  const res = await fetch(`${getBackendUrl()}/control-system/logs?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch logs: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerService(serviceId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getBackendUrl()}/control-system/trigger/${serviceId}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger service ${serviceId}: ${res.statusText}`);
  }
  return res.json();
}

export async function toggleService(serviceId: string): Promise<{ success: boolean; new_status: string }> {
  const res = await fetch(`${getBackendUrl()}/control-system/toggle/${serviceId}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to toggle service ${serviceId}: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerAllServices(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getBackendUrl()}/control-system/trigger-all`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger all services: ${res.statusText}`);
  }
  return res.json();
}

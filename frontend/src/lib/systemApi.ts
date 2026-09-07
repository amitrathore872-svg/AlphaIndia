import type { SystemSetting, SystemStatus } from "@/types/system";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/system";

/**
 * Fetch monitoring engine status.
 */
export async function fetchSystemStatus(): Promise<SystemStatus> {
  const response = await fetch(`${API_BASE}/status`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch monitoring status.");
  }

  return response.json();
}

/**
 * Fetch all monitoring settings.
 */
export async function fetchSystemSettings(): Promise<SystemSetting[]> {
  const response = await fetch(`${API_BASE}/settings`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch monitoring settings.");
  }

  return response.json();
}

/**
 * Update a single monitoring setting.
 */
export async function updateSystemSetting(
  key: string,
  value: string
): Promise<SystemSetting> {
  const response = await fetch(`${API_BASE}/settings/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      setting_value: value,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update setting: ${key}`);
  }

  return response.json();
}

/**
 * Reset monitoring settings to default values.
 */
export async function resetSystemSettings() {
  const response = await fetch(`${API_BASE}/settings/reset`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to reset monitoring settings.");
  }

  return response.json();
}
export async function updateSettingValue(
  key: string,
  value: string
) {
  return updateSystemSetting(key, value);
}
// =======================================================
// Alpha India Unified API Configuration
// =======================================================

export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function getBackendUrl(): string {
  return API_BASE;
}

/**
 * Standard fetch helper with timeout and unified error handling.
 */
export async function fetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `API request to ${url} failed with status ${res.status}: ${res.statusText} ${errorBody}`
    );
  }

  return res.json();
}

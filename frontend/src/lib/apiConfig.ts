// =======================================================
// Alpha India Unified API Configuration
// =======================================================

const rawBase: string =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Ensure localhost is normalized to 127.0.0.1 and trailing slash is stripped
export const API_BASE: string = rawBase
  .replace("//localhost:", "//127.0.0.1:")
  .replace(/\/$/, "");

export function getBackendUrl(): string {
  return API_BASE;
}

export function getWebSocketUrl(path: string): string {
  const httpUrl = getBackendUrl();
  let wsBase: string;
  if (httpUrl.startsWith("http")) {
    wsBase = httpUrl.replace(/^http/, "ws").replace(/\/api$/, "");
  } else if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsBase = `${proto}//${window.location.host}`;
  } else {
    wsBase = "ws://127.0.0.1:8000";
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${wsBase}${cleanPath}`;
}

/**
 * Standard fetch helper with timeout and unified error handling.
 */
export async function fetchJson<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const normalizedUrl = url.replace("//localhost:", "//127.0.0.1:");
  let fullUrl: string;
  if (normalizedUrl.startsWith("http")) {
    fullUrl = normalizedUrl;
  } else if (API_BASE && normalizedUrl.startsWith(API_BASE)) {
    fullUrl = normalizedUrl;
  } else {
    fullUrl = `${API_BASE}${normalizedUrl.startsWith("/") ? "" : "/"}${normalizedUrl}`;
  }

  const timeoutMs = options?.timeoutMs ?? 25000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      cache: "no-store",
      ...options,
      signal: options?.signal || controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...(options?.headers || {}),
      },
    });
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string } | undefined;
    if (errorObj?.name === "AbortError") {
      throw new Error(
        `API request to ${url} timed out after ${timeoutMs / 1000}s. Backend service at ${API_BASE} may be busy.`
      );
    }
    throw new Error(
      `Failed to connect to backend at ${fullUrl}: ${errorObj?.message || "Network Error / Server Unreachable"}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `API request to ${url} failed with status ${res.status}: ${res.statusText} ${errorBody}`
    );
  }

  return res.json();
}

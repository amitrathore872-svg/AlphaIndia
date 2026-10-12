// =======================================================
// Alpha India Unified API Configuration
// =======================================================

export function resolveApiBase(): string {
  let base: string = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "ipodesk.shop" || host === "www.ipodesk.shop" || host.endsWith(".ipodesk.shop")) {
      return `${window.location.origin}/api`;
    }
    // In local development, match current window hostname to prevent cross-host PNA blocks
    if (host === "localhost") {
      base = base.replace("//127.0.0.1:", "//localhost:");
    } else if (host === "127.0.0.1") {
      base = base.replace("//localhost:", "//127.0.0.1:");
    }
  }
  return base.replace(/\/$/, "");
}

export const API_BASE: string = resolveApiBase();

export function getBackendUrl(): string {
  return resolveApiBase();
}

export function getWebSocketUrl(path: string): string {
  let wsBase: string;
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsBase = `${proto}//${window.location.host}`;
  } else {
    const httpUrl = getBackendUrl();
    if (httpUrl.startsWith("http")) {
      wsBase = httpUrl.replace(/^http/, "ws").replace(/\/api$/, "");
    } else {
      wsBase = "ws://127.0.0.1:8000";
    }
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${wsBase}${cleanPath}`;
}

/**
 * Standard fetch helper with timeout, same-origin fallback, and unified error handling.
 */
export async function fetchJson<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const currentBase = resolveApiBase();
  let fullUrl: string;
  if (url.startsWith("http")) {
    fullUrl = url;
  } else if (currentBase && url.startsWith(currentBase)) {
    fullUrl = url;
  } else {
    fullUrl = `${currentBase}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  // Deduplicate any accidental /api/api occurrences
  fullUrl = fullUrl.replace(/\/api\/api(\/|$)/g, "/api$1");

  const timeoutMs = options?.timeoutMs ?? 25000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response | null = null;
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

    // If response was 502/503 and call went to api.ipodesk.shop, retry with same-origin /api
    if (
      !res.ok &&
      res.status >= 500 &&
      typeof window !== "undefined" &&
      fullUrl.includes("api.ipodesk.shop")
    ) {
      const urlObj = new URL(fullUrl, window.location.origin);
      let fallbackPath = urlObj.pathname + urlObj.search;
      if (!fallbackPath.startsWith("/api/")) {
        fallbackPath = `/api${fallbackPath.startsWith("/") ? "" : "/"}${fallbackPath}`;
      }
      const fallbackUrl = `${window.location.origin}${fallbackPath}`.replace(/\/api\/api\//g, "/api/");
      const fallbackRes = await fetch(fallbackUrl, {
        cache: "no-store",
        ...options,
        signal: options?.signal || controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          ...(options?.headers || {}),
        },
      }).catch(() => null);
      if (fallbackRes && fallbackRes.ok) {
        res = fallbackRes;
      }
    }
  } catch (err: unknown) {
    // If network fetch failed to api.ipodesk.shop, attempt same-origin /api retry
    if (typeof window !== "undefined" && fullUrl.includes("api.ipodesk.shop")) {
      try {
        const urlObj = new URL(fullUrl, window.location.origin);
        let fallbackPath = urlObj.pathname + urlObj.search;
        if (!fallbackPath.startsWith("/api/")) {
          fallbackPath = `/api${fallbackPath.startsWith("/") ? "" : "/"}${fallbackPath}`;
        }
        const fallbackUrl = `${window.location.origin}${fallbackPath}`.replace(/\/api\/api\//g, "/api/");
        res = await fetch(fallbackUrl, {
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
      } catch {
        // Fallback also failed, proceed with original error
      }
    }

    // If local dev fetch failed (e.g. localhost vs 127.0.0.1 PNA block), attempt alternate loopback address
    if (!res && typeof window !== "undefined" && (fullUrl.includes("//localhost:") || fullUrl.includes("//127.0.0.1:"))) {
      try {
        const altUrl = fullUrl.includes("//localhost:")
          ? fullUrl.replace("//localhost:", "//127.0.0.1:")
          : fullUrl.replace("//127.0.0.1:", "//localhost:");
        const altRes = await fetch(altUrl, {
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
        if (altRes && altRes.ok) {
          res = altRes;
        }
      } catch {
        // Fallback also failed
      }
    }

    if (!res) {
      const errorObj = err as { name?: string; message?: string } | undefined;
      if (errorObj?.name === "AbortError") {
        throw new Error(
          `API request to ${url} timed out after ${timeoutMs / 1000}s. Backend service at ${API_BASE} may be busy.`
        );
      }
      throw new Error(
        `Failed to connect to backend at ${fullUrl}: ${errorObj?.message || "Network Error / Server Unreachable"}`
      );
    }
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

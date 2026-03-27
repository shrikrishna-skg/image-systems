/** Base path or origin for API (must match axios client). */
export function getApiBase(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v === "string" && v.trim()) {
    return v.trim().replace(/\/+$/, "");
  }
  return "/api";
}

/** Production builds still pointing at template host — causes net::ERR_NAME_NOT_RESOLVED. */
export function isPlaceholderApiBaseUrl(): boolean {
  if (import.meta.env.DEV) return false;
  const base = getApiBase().toLowerCase();
  return (
    base.includes("your-api-host.example.com") ||
    base.includes("example.com/api") ||
    base === "https://example.com/api" ||
    base === "http://example.com/api"
  );
}

/**
 * Synchronous rejection for axios — avoids browser DNS/network spam when the API base
 * was never configured (e.g. Vercel missing VITE_API_BASE_URL).
 */
export function createApiBaseMisconfiguredError(): Error {
  const e = new Error(
    "API URL is not configured. In Vercel → Settings → Environment Variables, set VITE_API_BASE_URL to your deployed API (must end with /api), then redeploy."
  );
  e.name = "ApiBaseMisconfigured";
  return e;
}

export function isApiBaseMisconfiguredError(err: unknown): err is Error {
  return err instanceof Error && err.name === "ApiBaseMisconfigured";
}

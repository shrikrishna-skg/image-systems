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

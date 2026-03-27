/** Base path or origin for API (must match axios client). */
export function getApiBase(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v === "string" && v.trim()) {
    return v.trim().replace(/\/+$/, "");
  }
  return "/api";
}

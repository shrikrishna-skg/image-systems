function getApiBase() {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v === "string" && v.trim()) {
    return v.trim().replace(/\/+$/, "");
  }
  return "/api";
}
function isPlaceholderApiBaseUrl() {
  if (import.meta.env.DEV) return false;
  const base = getApiBase().toLowerCase();
  return base.includes("your-api-host.example.com") || base.includes("example.com/api") || base === "https://example.com/api" || base === "http://example.com/api";
}
function createApiBaseMisconfiguredError() {
  const e = new Error(
    "API URL is not configured. In Vercel \u2192 Settings \u2192 Environment Variables, set VITE_API_BASE_URL to your deployed API (must end with /api), then redeploy."
  );
  e.name = "ApiBaseMisconfigured";
  return e;
}
function isApiBaseMisconfiguredError(err) {
  return err instanceof Error && err.name === "ApiBaseMisconfigured";
}
export {
  createApiBaseMisconfiguredError,
  getApiBase,
  isApiBaseMisconfiguredError,
  isPlaceholderApiBaseUrl
};

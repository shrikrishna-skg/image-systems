import axios from "axios";
import { createApiBaseMisconfiguredError, isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isSupabaseAuthMisconfigured, supabase } from "../lib/supabase";

const localDev =
  import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true;

const verboseApiLogs =
  import.meta.env.DEV &&
  (import.meta.env.VITE_VERBOSE_API_LOGS === "true" || import.meta.env.VITE_VERBOSE_API_LOGS === true);

const SENSITIVE_LOG_KEYS = new Set([
  "api_key",
  "password",
  "access_token",
  "refresh_token",
  "token",
  "secret",
  "authorization",
]);

/** Strip secrets from dev console logging (never log provider keys or auth material). */
function redactForVerboseLog(data: unknown): unknown {
  if (data == null) return data;
  if (typeof data !== "object") return data;
  if (data instanceof FormData) return "[FormData]";
  if (Array.isArray(data)) return data.map(redactForVerboseLog);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const low = k.toLowerCase();
    if (SENSITIVE_LOG_KEYS.has(low) || low.includes("secret") || low.includes("password")) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactForVerboseLog(v);
    }
  }
  return out;
}

/** Prefer relative `/api` in dev so Vite proxies to the backend (any dev port, no CORS). */
const API_BASE_URL =
  (typeof import.meta.env.VITE_API_BASE_URL === "string"
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : "") || "/api";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

/** Do not hit the network when the build still uses a template API host (Vercel env not set). */
client.interceptors.request.use(
  (config) => {
    if (isPlaceholderApiBaseUrl()) {
      return Promise.reject(createApiBaseMisconfiguredError());
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add auth token to requests (local JWT or Supabase session)
client.interceptors.request.use(
  async (config) => {
    if (verboseApiLogs) {
      const url = `${config.baseURL ?? ""}${config.url ?? ""}`;
      if (config.data instanceof FormData) {
        const n = config.data.getAll("files").length;
        console.log(`[API] → ${(config.method ?? "GET").toUpperCase()} ${url} (multipart, ${n} file(s))`);
      } else {
        console.log(
          `[API] → ${(config.method ?? "GET").toUpperCase()} ${url}`,
          redactForVerboseLog(config.data) ?? ""
        );
      }
    }
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers?.["Content-Type"];
    }
    if (localDev) {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      return config;
    }
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (err) {
      console.error("Failed to get Supabase session:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 — refresh Supabase session (skipped in local dev)
client.interceptors.response.use(
  (response) => {
    if (verboseApiLogs) {
      const url = `${response.config.baseURL ?? ""}${response.config.url ?? ""}`;
      if (response.config.responseType === "blob") {
        const ct = response.headers["content-type"];
        console.log(`[API] ← ${response.status} ${url} (blob${ct ? ` ${ct}` : ""})`);
      } else {
        console.log(`[API] ← ${response.status} ${url}`, response.data);
      }
    }
    return response;
  },
  async (error) => {
    if (verboseApiLogs) {
      const cfg = error.config;
      const url = cfg ? `${cfg.baseURL ?? ""}${cfg.url ?? ""}` : "";
      console.log(
        `[API] ← error ${error.response?.status ?? "—"} ${cfg?.method?.toUpperCase() ?? ""} ${url}`,
        error.response?.data ?? error.message
      );
    }
    if (localDev) {
      return Promise.reject(error);
    }
    if (isSupabaseAuthMisconfigured()) {
      return Promise.reject(error);
    }
    const originalRequest = error.config;

    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const { data } = await supabase.auth.refreshSession();
        if (data?.session) {
          originalRequest.headers["Authorization"] = `Bearer ${data.session.access_token}`;
          return client(originalRequest);
        }
      } catch {
        // Refresh failed
      }

      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default client;

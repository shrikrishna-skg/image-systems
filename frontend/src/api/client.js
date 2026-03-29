import axios from "axios";
import { toast } from "sonner";
import { createApiBaseMisconfiguredError, isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isSupabaseAuthMisconfigured, supabase } from "../lib/supabase";
const localDev = import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true;
const verboseApiLogs = import.meta.env.DEV && (import.meta.env.VITE_VERBOSE_API_LOGS === "true" || import.meta.env.VITE_VERBOSE_API_LOGS === true);
const SENSITIVE_LOG_KEYS = /* @__PURE__ */ new Set([
  "api_key",
  "password",
  "access_token",
  "refresh_token",
  "token",
  "secret",
  "authorization"
]);
function redactForVerboseLog(data) {
  if (data == null) return data;
  if (typeof data !== "object") return data;
  if (data instanceof FormData) return "[FormData]";
  if (Array.isArray(data)) return data.map(redactForVerboseLog);
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    const low = k.toLowerCase();
    if (SENSITIVE_LOG_KEYS.has(low) || low.includes("secret") || low.includes("password")) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactForVerboseLog(v);
    }
  }
  return out;
}
const API_BASE_URL = (typeof import.meta.env.VITE_API_BASE_URL === "string" ? import.meta.env.VITE_API_BASE_URL.trim() : "") || "/api";
const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 600_000
});
client.interceptors.request.use(
  (config) => {
    if (isPlaceholderApiBaseUrl()) {
      return Promise.reject(createApiBaseMisconfiguredError());
    }
    return config;
  },
  (error) => Promise.reject(error)
);
client.interceptors.request.use(
  async (config) => {
    if (verboseApiLogs) {
      const url = `${config.baseURL ?? ""}${config.url ?? ""}`;
      if (config.data instanceof FormData) {
        const n = config.data.getAll("files").length;
        console.log(`[API] \u2192 ${(config.method ?? "GET").toUpperCase()} ${url} (multipart, ${n} file(s))`);
      } else {
        console.log(
          `[API] \u2192 ${(config.method ?? "GET").toUpperCase()} ${url}`,
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
client.interceptors.response.use(
  (response) => {
    if (verboseApiLogs) {
      const url = `${response.config.baseURL ?? ""}${response.config.url ?? ""}`;
      if (response.config.responseType === "blob") {
        const ct = response.headers["content-type"];
        console.log(`[API] \u2190 ${response.status} ${url} (blob${ct ? ` ${ct}` : ""})`);
      } else {
        console.log(`[API] \u2190 ${response.status} ${url}`, response.data);
      }
    }
    return response;
  },
  async (error) => {
    if (verboseApiLogs) {
      const cfg = error.config;
      const url = cfg ? `${cfg.baseURL ?? ""}${cfg.url ?? ""}` : "";
      console.log(
        `[API] \u2190 error ${error.response?.status ?? "\u2014"} ${cfg?.method?.toUpperCase() ?? ""} ${url}`,
        error.response?.data ?? error.message
      );
    }
    if (error.response) {
      const status = error.response.status;
      if (status === 403) {
        toast.error("You do not have permission to do that.");
      } else if (status >= 500 && status < 600) {
        toast.error("The server had a problem. Try again in a moment.");
      }
    }
    if (localDev) {
      return Promise.reject(error);
    }
    if (isSupabaseAuthMisconfigured()) {
      return Promise.reject(error);
    }
    const originalRequest = error.config;
    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await supabase.auth.refreshSession();
        if (data?.session) {
          originalRequest.headers["Authorization"] = `Bearer ${data.session.access_token}`;
          return client(originalRequest);
        }
      } catch {
      }
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
var stdin_default = client;
export {
  stdin_default as default
};

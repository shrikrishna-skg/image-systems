import { createClient } from "@supabase/supabase-js";
import { isStorageOnlyMode } from "./storageOnlyMode";
const storageOnly = isStorageOnlyMode();
const explicitLocalDev = import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true;
const usesLocalOrStorageAuth = explicitLocalDev || storageOnly;
const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const trimmedSupabaseUrl = typeof rawUrl === "string" ? rawUrl.trim().replace(/\/+$/, "") : "";
const trimmedSupabaseAnonKey = typeof rawKey === "string" ? rawKey.trim() : "";
function isSupabaseAuthMisconfigured() {
  if (usesLocalOrStorageAuth) return false;
  return !trimmedSupabaseUrl || !trimmedSupabaseAnonKey;
}
const urlForClient = usesLocalOrStorageAuth ? "http://127.0.0.1" : isSupabaseAuthMisconfigured() ? "https://config-required.localhost" : trimmedSupabaseUrl;
const keyForClient = usesLocalOrStorageAuth ? "local-dev-placeholder" : isSupabaseAuthMisconfigured() ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.misconfigured" : trimmedSupabaseAnonKey;
const persistRemoteSession = !usesLocalOrStorageAuth && !isSupabaseAuthMisconfigured();
function getAuthRedirectOrigin() {
  const raw = import.meta.env.VITE_AUTH_REDIRECT_ORIGIN;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}
const supabase = createClient(urlForClient, keyForClient, {
  auth: {
    persistSession: persistRemoteSession,
    autoRefreshToken: persistRemoteSession,
    /** Parse `#access_token=…` / magic links after email confirmation. */
    detectSessionInUrl: persistRemoteSession
  }
});
if (import.meta.env.DEV && storageOnly) {
  console.info("[Storage-only] Images saved in this browser (IndexedDB). No API server.");
}
if (import.meta.env.DEV && usesLocalOrStorageAuth && !storageOnly) {
  console.info("[Local dev] SQLite + JWT; run `npm run dev` from repo root for the API + web.");
}
if (import.meta.env.DEV && !usesLocalOrStorageAuth && !isSupabaseAuthMisconfigured()) {
  void (async () => {
    try {
      const res = await fetch(`${trimmedSupabaseUrl}/auth/v1/health`, {
        headers: { apikey: trimmedSupabaseAnonKey }
      });
      if (!res.ok) {
        console.warn(
          `[Supabase] Auth health returned HTTP ${res.status}. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.`
        );
        return;
      }
      const body = await res.json().catch(() => null);
      console.info(
        `[Supabase] Connected (${body?.name ?? "GoTrue"} ${body?.version ?? ""}).`
      );
    } catch (e) {
      console.warn(
        "[Supabase] Could not reach your project URL. Check VITE_SUPABASE_URL and your network.",
        e
      );
    }
  })();
}
export {
  getAuthRedirectOrigin,
  isSupabaseAuthMisconfigured,
  supabase,
  usesLocalOrStorageAuth
};

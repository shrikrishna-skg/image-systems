import { createClient } from "@supabase/supabase-js";
import { isStorageOnlyMode } from "./storageOnlyMode";

const storageOnly = isStorageOnlyMode();
const explicitLocalDev =
  import.meta.env.VITE_LOCAL_DEV_MODE === "true" || import.meta.env.VITE_LOCAL_DEV_MODE === true;

/** True when auth uses SQLite/JWT or browser-only storage — not Supabase Auth. */
export const usesLocalOrStorageAuth = explicitLocalDev || storageOnly;

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const trimmedSupabaseUrl =
  typeof rawUrl === "string" ? rawUrl.trim().replace(/\/+$/, "") : "";
const trimmedSupabaseAnonKey = typeof rawKey === "string" ? rawKey.trim() : "";

/**
 * Hosted / default production mode expects Supabase for sign-in unless local JWT or storage-only.
 * When this is true, show configuration UI instead of crashing at import time.
 */
export function isSupabaseAuthMisconfigured(): boolean {
  if (usesLocalOrStorageAuth) return false;
  return !trimmedSupabaseUrl || !trimmedSupabaseAnonKey;
}

const urlForClient = usesLocalOrStorageAuth
  ? "http://127.0.0.1"
  : isSupabaseAuthMisconfigured()
    ? "https://config-required.localhost"
    : trimmedSupabaseUrl;

const keyForClient = usesLocalOrStorageAuth
  ? "local-dev-placeholder"
  : isSupabaseAuthMisconfigured()
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.misconfigured"
    : trimmedSupabaseAnonKey;

const persistRemoteSession =
  !usesLocalOrStorageAuth && !isSupabaseAuthMisconfigured();

/**
 * Origin used in Supabase email links (confirm signup, reset password).
 * Defaults to `window.location.origin`. Set `VITE_AUTH_REDIRECT_ORIGIN` when you develop on
 * localhost but want links to open your production app (e.g. https://image-systems.vercel.app).
 */
export function getAuthRedirectOrigin(): string {
  const raw = import.meta.env.VITE_AUTH_REDIRECT_ORIGIN;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

export const supabase = createClient(urlForClient, keyForClient, {
  auth: {
    persistSession: persistRemoteSession,
    autoRefreshToken: persistRemoteSession,
    /** Parse `#access_token=…` / magic links after email confirmation. */
    detectSessionInUrl: persistRemoteSession,
  },
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
        headers: { apikey: trimmedSupabaseAnonKey },
      });
      if (!res.ok) {
        console.warn(
          `[Supabase] Auth health returned HTTP ${res.status}. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.`
        );
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        name?: string;
        version?: string;
      } | null;
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

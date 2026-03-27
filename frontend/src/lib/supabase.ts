import { createClient } from "@supabase/supabase-js";
import { isStorageOnlyMode } from "./storageOnlyMode";

const storageOnly = isStorageOnlyMode();
const localDev =
  import.meta.env.VITE_LOCAL_DEV_MODE === "true" ||
  import.meta.env.VITE_LOCAL_DEV_MODE === true ||
  storageOnly;

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl =
  typeof rawUrl === "string" ? rawUrl.trim().replace(/\/+$/, "") : "";
const supabaseAnonKey = typeof rawKey === "string" ? rawKey.trim() : "";

if (!localDev && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    "Missing Supabase env vars. Copy frontend/.env.example to frontend/.env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Supabase Dashboard → API keys). Or set VITE_STORAGE_ONLY=true for browser-only mode (no server)."
  );
}

export const supabase = createClient(
  localDev ? "http://127.0.0.1" : supabaseUrl,
  localDev ? "local-dev-placeholder" : supabaseAnonKey,
  {
    auth: {
      persistSession: !localDev,
      autoRefreshToken: !localDev,
    },
  }
);

if (import.meta.env.DEV && storageOnly) {
  console.info("[Storage-only] Images saved in this browser (IndexedDB). No API server.");
}

if (import.meta.env.DEV && localDev && !storageOnly) {
  console.info("[Local dev] SQLite + JWT; run `npm run dev` from repo root for the API + web.");
}

/** Dev-only: confirms the project URL and key reach Supabase Auth (does not log secrets). */
if (import.meta.env.DEV && !localDev) {
  void (async () => {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: supabaseAnonKey },
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

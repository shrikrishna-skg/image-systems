import { create } from "zustand";
import { getApiBase } from "../lib/apiBase";
import { clearImageBlobCache } from "../lib/imageBlobCache";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import {
  EmailConfirmationPendingError,
  formatSupabaseAuthError,
} from "../lib/supabaseAuthErrors";
import { isSupabaseAuthMisconfigured, supabase } from "../lib/supabase";
import type { User } from "../types";

const storageOnly = isStorageOnlyMode();
const localDev =
  import.meta.env.VITE_LOCAL_DEV_MODE === "true" ||
  import.meta.env.VITE_LOCAL_DEV_MODE === true ||
  storageOnly;

const verboseApiLogs =
  import.meta.env.DEV &&
  (import.meta.env.VITE_VERBOSE_API_LOGS === "true" || import.meta.env.VITE_VERBOSE_API_LOGS === true);

const API_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function readErrorDetail(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x)))
        .join(", ");
    }
  } catch {
    /* ignore */
  }
  return text || res.statusText || "Request failed";
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    if (localDev) {
      const base = getApiBase();
      const sessionUrl = `${base}/auth/local/session`;
      if (verboseApiLogs) console.log(`[API] → POST ${sessionUrl}`);
      let res: Response;
      try {
        res = await fetchWithTimeout(sessionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        const err = e instanceof Error && e.name === "AbortError";
        if (aborted || err) {
          throw new Error(
            "Cannot reach the API (timed out). From the repo root run npm run dev so the backend is on port 8000."
          );
        }
        throw e;
      }
      if (verboseApiLogs) console.log(`[API] ← ${res.status} POST ${sessionUrl}`);
      if (!res.ok) {
        throw new Error(await readErrorDetail(res));
      }
      const data = (await res.json()) as {
        access_token: string;
        user?: {
          id: string;
          email: string;
          full_name: string | null;
          images_processed: number;
          created_at: string;
        };
      };
      localStorage.setItem("access_token", data.access_token);
      if (data.user) {
        set({
          user: {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.full_name,
            images_processed: data.user.images_processed,
            created_at: data.user.created_at,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        await get().loadUser();
      }
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(formatSupabaseAuthError(error));

    const user: User = {
      id: data.user.id,
      email: data.user.email || "",
      full_name: data.user.user_metadata?.full_name || null,
      images_processed: 0,
      created_at: data.user.created_at,
    };
    set({ user, isAuthenticated: true, isLoading: false });
  },

  register: async (email, password, fullName) => {
    if (localDev) {
      const base = getApiBase();
      const sessionUrl = `${base}/auth/local/session`;
      if (verboseApiLogs) console.log(`[API] → POST ${sessionUrl} (register)`);
      let res: Response;
      try {
        res = await fetchWithTimeout(sessionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, full_name: fullName ?? "" }),
        });
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        const err = e instanceof Error && e.name === "AbortError";
        if (aborted || err) {
          throw new Error(
            "Cannot reach the API (timed out). From the repo root run npm run dev so the backend is on port 8000."
          );
        }
        throw e;
      }
      if (!res.ok) {
        throw new Error(await readErrorDetail(res));
      }
      const data = (await res.json()) as {
        access_token: string;
        user?: {
          id: string;
          email: string;
          full_name: string | null;
          images_processed: number;
          created_at: string;
        };
      };
      localStorage.setItem("access_token", data.access_token);
      if (data.user) {
        set({
          user: {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.full_name,
            images_processed: data.user.images_processed,
            created_at: data.user.created_at,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        await get().loadUser();
      }
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || "" },
      },
    });
    if (error) throw new Error(formatSupabaseAuthError(error));
    if (!data.user) throw new Error("Registration failed");

    if (!data.session) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      throw new EmailConfirmationPendingError(data.user.email ?? email);
    }

    const user: User = {
      id: data.user.id,
      email: data.user.email || "",
      full_name: fullName || null,
      images_processed: 0,
      created_at: data.user.created_at,
    };
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    clearImageBlobCache();
    if (localDev) {
      localStorage.removeItem("access_token");
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    if (isSupabaseAuthMisconfigured()) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadUser: async () => {
    if (storageOnly) {
      set({
        user: {
          id: "local-browser",
          email: "this device",
          full_name: "Local storage",
          images_processed: 0,
          created_at: new Date().toISOString(),
        },
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }
    if (localDev) {
      try {
        const base = getApiBase();
        const token = localStorage.getItem("access_token");
        if (!token) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        const meUrl = `${base}/auth/me`;
        if (verboseApiLogs) console.log(`[API] → GET ${meUrl}`);
        let me: Response;
        try {
          me = await fetchWithTimeout(meUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (e) {
          const aborted = e instanceof DOMException && e.name === "AbortError";
          const err = e instanceof Error && e.name === "AbortError";
          if (aborted || err) {
            if (verboseApiLogs) console.warn("[API] GET /auth/me timed out — is the backend running?");
          }
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        if (verboseApiLogs) console.log(`[API] ← ${me.status} GET ${meUrl}`);
        if (!me.ok) {
          localStorage.removeItem("access_token");
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        const u = (await me.json()) as {
          id: string;
          email: string;
          full_name: string | null;
          images_processed: number;
          created_at: string;
        };
        const user: User = {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          images_processed: u.images_processed,
          created_at: u.created_at,
        };
        set({ user, isAuthenticated: true, isLoading: false });
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
      return;
    }

    if (isSupabaseAuthMisconfigured()) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const user: User = {
          id: session.user.id,
          email: session.user.email || "",
          full_name: session.user.user_metadata?.full_name || null,
          images_processed: 0,
          created_at: session.user.created_at,
        };
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

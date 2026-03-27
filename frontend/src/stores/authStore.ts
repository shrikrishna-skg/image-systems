import { create } from "zustand";
import { getApiBase } from "../lib/apiBase";
import { clearImageBlobCache } from "../lib/imageBlobCache";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import { supabase } from "../lib/supabase";
import type { User } from "../types";

const storageOnly = isStorageOnlyMode();
const localDev =
  import.meta.env.VITE_LOCAL_DEV_MODE === "true" ||
  import.meta.env.VITE_LOCAL_DEV_MODE === true ||
  storageOnly;

const verboseApiLogs =
  import.meta.env.DEV &&
  (import.meta.env.VITE_VERBOSE_API_LOGS === "true" || import.meta.env.VITE_VERBOSE_API_LOGS === true);

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
      await get().loadUser();
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

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
      await get().loadUser();
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || "" },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Registration failed");

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
        let token = localStorage.getItem("access_token");
        if (!token) {
          const sessionUrl = `${base}/auth/local/session`;
          if (verboseApiLogs) console.log(`[API] → POST ${sessionUrl}`);
          const res = await fetch(sessionUrl, { method: "POST" });
          if (verboseApiLogs) console.log(`[API] ← ${res.status} POST ${sessionUrl}`);
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || res.statusText);
          }
          const data = (await res.json()) as { access_token: string };
          token = data.access_token;
          localStorage.setItem("access_token", token);
        }
        const meUrl = `${base}/auth/me`;
        if (verboseApiLogs) console.log(`[API] → GET ${meUrl}`);
        const me = await fetch(meUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
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

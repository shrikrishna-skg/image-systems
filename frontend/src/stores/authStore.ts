import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
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
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadUser: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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

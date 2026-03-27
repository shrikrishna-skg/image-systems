import { create } from "zustand";
import { getHealth } from "../api/health";
import { isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";

/** Backend API reachability for the hosted stack (Vercel UI + Supabase + API). */
export type ApiConnectionStatus = "pending" | "ok" | "offline" | "misconfigured" | "skipped";

interface ServerPolicyState {
  persistImageFiles: boolean;
  ephemeralGraceSeconds: number;
  policyLoaded: boolean;
  apiConnectionStatus: ApiConnectionStatus;
  fetchPolicy: () => Promise<void>;
}

export const useServerPolicyStore = create<ServerPolicyState>((set) => ({
  persistImageFiles: true,
  ephemeralGraceSeconds: 180,
  policyLoaded: false,
  apiConnectionStatus: "pending",
  fetchPolicy: async () => {
    if (isStorageOnlyMode()) {
      set({
        persistImageFiles: true,
        policyLoaded: true,
        apiConnectionStatus: "skipped",
      });
      return;
    }
    if (isPlaceholderApiBaseUrl()) {
      set({
        persistImageFiles: true,
        policyLoaded: true,
        apiConnectionStatus: "misconfigured",
      });
      return;
    }
    try {
      const h = await getHealth();
      set({
        persistImageFiles: h.persist_image_files_on_server !== false,
        ephemeralGraceSeconds: Math.max(30, h.ephemeral_image_grace_seconds ?? 180),
        policyLoaded: true,
        apiConnectionStatus: "ok",
      });
    } catch {
      set({ policyLoaded: true, apiConnectionStatus: "offline" });
    }
  },
}));

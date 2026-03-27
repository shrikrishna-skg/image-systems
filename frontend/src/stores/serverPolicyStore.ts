import { create } from "zustand";
import { getHealth } from "../api/health";
import { isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";

interface ServerPolicyState {
  persistImageFiles: boolean;
  ephemeralGraceSeconds: number;
  policyLoaded: boolean;
  fetchPolicy: () => Promise<void>;
}

export const useServerPolicyStore = create<ServerPolicyState>((set) => ({
  persistImageFiles: true,
  ephemeralGraceSeconds: 180,
  policyLoaded: false,
  fetchPolicy: async () => {
    if (isStorageOnlyMode()) {
      set({ persistImageFiles: true, policyLoaded: true });
      return;
    }
    if (isPlaceholderApiBaseUrl()) {
      set({ persistImageFiles: true, policyLoaded: true });
      return;
    }
    try {
      const h = await getHealth();
      set({
        persistImageFiles: h.persist_image_files_on_server !== false,
        ephemeralGraceSeconds: Math.max(30, h.ephemeral_image_grace_seconds ?? 180),
        policyLoaded: true,
      });
    } catch {
      set({ policyLoaded: true });
    }
  },
}));

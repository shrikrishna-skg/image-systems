import { create } from "zustand";
import { getHealth } from "../api/health";
import { isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
const useServerPolicyStore = create((set) => ({
  persistImageFiles: true,
  ephemeralGraceSeconds: 180,
  policyLoaded: false,
  apiConnectionStatus: "pending",
  fetchPolicy: async () => {
    if (isStorageOnlyMode()) {
      set({
        persistImageFiles: true,
        policyLoaded: true,
        apiConnectionStatus: "skipped"
      });
      return;
    }
    if (isPlaceholderApiBaseUrl()) {
      set({
        persistImageFiles: true,
        policyLoaded: true,
        apiConnectionStatus: "misconfigured"
      });
      return;
    }
    try {
      const h = await getHealth();
      set({
        persistImageFiles: h.persist_image_files_on_server !== false,
        ephemeralGraceSeconds: Math.max(30, h.ephemeral_image_grace_seconds ?? 180),
        policyLoaded: true,
        apiConnectionStatus: "ok"
      });
    } catch {
      set({ policyLoaded: true, apiConnectionStatus: "offline" });
    }
  }
}));
export {
  useServerPolicyStore
};

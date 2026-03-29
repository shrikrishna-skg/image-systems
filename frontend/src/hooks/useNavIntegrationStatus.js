import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { listKeys } from "../api/apiKeys";
import { listImages } from "../api/images";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
const storageOnly = isStorageOnlyMode();
function useNavIntegrationStatus() {
  const { pathname } = useLocation();
  const [state, setState] = useState({
    hasEnhanceKey: false,
    hasAnyProviderKey: false,
    archiveCount: null,
    loading: !storageOnly
  });
  useEffect(() => {
    if (storageOnly) {
      setState({
        hasEnhanceKey: true,
        hasAnyProviderKey: true,
        archiveCount: null,
        loading: false
      });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    void (async () => {
      try {
        const keys = await listKeys();
        if (cancelled) return;
        const hasOpenAI = keys.some((k) => k.provider === "openai");
        const hasGemini = keys.some((k) => k.provider === "gemini");
        const hasEnhanceKey = hasOpenAI || hasGemini;
        const hasAnyProviderKey = keys.length > 0;
        let archiveCount = null;
        try {
          const imgs = await listImages(0, 500);
          if (!cancelled) archiveCount = imgs.length;
        } catch {
          if (!cancelled) archiveCount = null;
        }
        if (!cancelled) {
          setState({
            hasEnhanceKey,
            hasAnyProviderKey,
            archiveCount,
            loading: false
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            hasEnhanceKey: false,
            hasAnyProviderKey: false,
            archiveCount: null,
            loading: false
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  return state;
}
export {
  useNavIntegrationStatus
};

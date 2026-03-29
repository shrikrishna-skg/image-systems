import { create } from "zustand";
import { workspaceImageSyncFingerprint } from "../lib/workspaceImageFingerprint";
import { MAX_WORKSPACE_ASSETS } from "../lib/workspaceLimits";
import { GEMINI_IMAGE_MODELS, OPENAI_IMAGE_MODELS } from "../lib/providerIntegrationMeta";
const ENHANCE_MODEL_PREFS_KEY = "iep-enhance-model-prefs-v1";
const OPENAI_MODEL_SET = new Set(OPENAI_IMAGE_MODELS);
const GEMINI_MODEL_SET = new Set(GEMINI_IMAGE_MODELS);
function coerceOpenaiModel(saved) {
  if (saved && OPENAI_MODEL_SET.has(saved)) return saved;
  return OPENAI_IMAGE_MODELS[0];
}
function coerceGeminiModel(saved) {
  if (saved && GEMINI_MODEL_SET.has(saved)) return saved;
  return GEMINI_IMAGE_MODELS[0];
}
function loadEnhanceModelPrefs() {
  try {
    const raw = localStorage.getItem(ENHANCE_MODEL_PREFS_KEY);
    if (!raw) {
      return {
        openaiModelPref: OPENAI_IMAGE_MODELS[0],
        geminiModelPref: GEMINI_IMAGE_MODELS[0]
      };
    }
    const parsed = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object") {
      return {
        openaiModelPref: OPENAI_IMAGE_MODELS[0],
        geminiModelPref: GEMINI_IMAGE_MODELS[0]
      };
    }
    const o = parsed.openai;
    const g = parsed.gemini;
    return {
      openaiModelPref: coerceOpenaiModel(typeof o === "string" ? o : void 0),
      geminiModelPref: coerceGeminiModel(typeof g === "string" ? g : void 0)
    };
  } catch {
    return {
      openaiModelPref: OPENAI_IMAGE_MODELS[0],
      geminiModelPref: GEMINI_IMAGE_MODELS[0]
    };
  }
}
function persistEnhanceModelPrefs(openaiModelPref, geminiModelPref) {
  try {
    localStorage.setItem(
      ENHANCE_MODEL_PREFS_KEY,
      JSON.stringify({ openai: openaiModelPref, gemini: geminiModelPref })
    );
  } catch {
  }
}
const initialEnhancePrefs = loadEnhanceModelPrefs();
const ARCHIVE_STORAGE_KEY = "iep-workspace-archive-v1";
const WORKSPACE_MODE_KEY = "iep-workspace-mode-v1";
const MAX_WORKSPACE_ARCHIVE = 48;
function loadWorkspaceModePreference() {
  try {
    return localStorage.getItem(WORKSPACE_MODE_KEY) === "1";
  } catch {
    return false;
  }
}
function persistWorkspaceModePreference(enabled) {
  try {
    if (enabled) localStorage.setItem(WORKSPACE_MODE_KEY, "1");
    else localStorage.removeItem(WORKSPACE_MODE_KEY);
  } catch {
  }
}
function cloneImageInfo(img) {
  return {
    ...img,
    versions: img.versions.map((v) => ({ ...v }))
  };
}
function loadWorkspaceArchive() {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) => row != null && typeof row === "object" && typeof row.key === "string" && typeof row.archivedAt === "string" && row.image != null && typeof row.image.id === "string"
    );
  } catch {
    return [];
  }
}
function persistWorkspaceArchive(rows) {
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(rows));
  } catch {
  }
}
const useImageStore = create((set) => ({
  archivedWorkspaceImages: loadWorkspaceArchive(),
  workspaceMode: loadWorkspaceModePreference(),
  setWorkspaceMode: (enabled) => {
    persistWorkspaceModePreference(enabled);
    set((s) => {
      if (!enabled) {
        const keep = s.currentImage ?? s.sessionImages[0] ?? null;
        return {
          workspaceMode: false,
          sessionImages: [],
          currentImage: keep,
          currentJob: null
        };
      }
      if (s.sessionImages.length === 0 && s.currentImage) {
        return {
          workspaceMode: true,
          sessionImages: [s.currentImage],
          currentImage: s.currentImage
        };
      }
      return { workspaceMode: true };
    });
  },
  setStandardImport: (image) => set({
    sessionImages: [],
    currentImage: image,
    currentJob: null
  }),
  currentImage: null,
  setCurrentImage: (image) => set({ currentImage: image }),
  sessionImages: [],
  addImagesToSession: (incoming) => {
    const result = { added: 0, droppedDueToCapacity: 0, duplicatesSkipped: 0 };
    if (incoming.length === 0) return result;
    set((s) => {
      const seen = new Set(s.sessionImages.map((i) => i.id));
      const next = [...s.sessionImages];
      for (const img of incoming) {
        if (seen.has(img.id)) {
          result.duplicatesSkipped += 1;
          continue;
        }
        if (next.length >= MAX_WORKSPACE_ASSETS) {
          result.droppedDueToCapacity += 1;
          continue;
        }
        next.push(img);
        seen.add(img.id);
        result.added += 1;
      }
      const cur = s.currentImage;
      const curStillThere = cur ? next.some((i) => i.id === cur.id) : false;
      const newCurrent = cur && curStillThere ? cur : incoming.find((img) => next.some((x) => x.id === img.id)) ?? next[0] ?? null;
      return {
        sessionImages: next,
        currentImage: newCurrent
      };
    });
    return result;
  },
  upsertSessionImage: (image) => set((s) => {
    const idx = s.sessionImages.findIndex((i) => i.id === image.id);
    if (idx >= 0) {
      const prev = s.sessionImages[idx];
      if (workspaceImageSyncFingerprint(prev) === workspaceImageSyncFingerprint(image)) {
        if (s.currentImage?.id === image.id && s.currentImage !== prev) {
          return { currentImage: image };
        }
        return s;
      }
      const nextSession = s.sessionImages.slice();
      nextSession[idx] = image;
      return {
        sessionImages: nextSession,
        currentImage: s.currentImage?.id === image.id ? image : s.currentImage
      };
    }
    if (s.currentImage?.id === image.id) {
      if (workspaceImageSyncFingerprint(s.currentImage) === workspaceImageSyncFingerprint(image)) {
        return s;
      }
      return { currentImage: image };
    }
    return s;
  }),
  removeSessionImage: (id) => set((s) => {
    const next = s.sessionImages.filter((i) => i.id !== id);
    const cur = s.currentImage;
    const nextCurrent = cur?.id === id ? next[0] ?? null : cur;
    return { sessionImages: next, currentImage: nextCurrent };
  }),
  replaceSessionWith: (images) => set((s) => {
    const slice = images.slice(0, MAX_WORKSPACE_ASSETS);
    const first = slice[0] ?? null;
    if (!s.workspaceMode) {
      return {
        sessionImages: [],
        currentImage: first,
        currentJob: null
      };
    }
    return {
      sessionImages: slice,
      currentImage: first,
      currentJob: null
    };
  }),
  removeArchivedWorkspaceImage: (key) => set((s) => {
    const archivedWorkspaceImages = s.archivedWorkspaceImages.filter((e) => e.key !== key);
    persistWorkspaceArchive(archivedWorkspaceImages);
    return { archivedWorkspaceImages };
  }),
  clearWorkspaceArchive: () => set(() => {
    persistWorkspaceArchive([]);
    return { archivedWorkspaceImages: [] };
  }),
  restoreArchivedWorkspaceImage: (key) => {
    let ok = false;
    set((s) => {
      const entry = s.archivedWorkspaceImages.find((e) => e.key === key);
      if (!entry) return s;
      const img = cloneImageInfo(entry.image);
      const already = s.sessionImages.some((i) => i.id === img.id);
      if (s.workspaceMode && !already && s.sessionImages.length >= MAX_WORKSPACE_ASSETS) {
        return s;
      }
      ok = true;
      const archivedWorkspaceImages = s.archivedWorkspaceImages.filter((e) => e.key !== key);
      persistWorkspaceArchive(archivedWorkspaceImages);
      if (!s.workspaceMode) {
        return {
          archivedWorkspaceImages,
          sessionImages: [],
          currentImage: img,
          currentJob: null
        };
      }
      const sessionImages = s.sessionImages.length === 0 ? [img] : already ? s.sessionImages.map((i) => i.id === img.id ? img : i) : [...s.sessionImages, img];
      return {
        archivedWorkspaceImages,
        sessionImages,
        currentImage: img,
        currentJob: null
      };
    });
    return ok;
  },
  provider: "improve",
  model: "browser",
  openaiModelPref: initialEnhancePrefs.openaiModelPref,
  geminiModelPref: initialEnhancePrefs.geminiModelPref,
  lighting: "bright",
  qualityPreset: "full_enhance",
  perspective: "straighten",
  roomType: "general",
  customPrompt: null,
  quality: "high",
  scaleFactor: 2,
  targetResolution: "4k",
  outputFormat: "png",
  setProvider: (provider) => {
    set((s) => {
      if (provider === "improve") {
        return { provider, model: "browser", quality: "high" };
      }
      if (provider === "openai") {
        const model = coerceOpenaiModel(s.openaiModelPref);
        return { provider, model, openaiModelPref: model, quality: "high" };
      }
      if (provider === "gemini") {
        const model = coerceGeminiModel(s.geminiModelPref);
        return { provider, model, geminiModelPref: model, quality: "high" };
      }
      return { provider, model: s.model, quality: "high" };
    });
  },
  setModel: (model) => set((s) => {
    if (s.provider === "openai" && OPENAI_MODEL_SET.has(model)) {
      persistEnhanceModelPrefs(model, s.geminiModelPref);
      return { model, openaiModelPref: model };
    }
    if (s.provider === "gemini" && GEMINI_MODEL_SET.has(model)) {
      persistEnhanceModelPrefs(s.openaiModelPref, model);
      return { model, geminiModelPref: model };
    }
    return { model };
  }),
  setLighting: (lighting) => set({ lighting }),
  setQualityPreset: (qualityPreset) => set({ qualityPreset }),
  setPerspective: (perspective) => set({ perspective }),
  setRoomType: (roomType) => set({ roomType }),
  setCustomPrompt: (customPrompt) => set({ customPrompt }),
  setQuality: (quality) => set({ quality }),
  setScaleFactor: (scaleFactor) => set({ scaleFactor }),
  setTargetResolution: (targetResolution) => set({ targetResolution }),
  setOutputFormat: (outputFormat) => set({ outputFormat }),
  currentJob: null,
  setCurrentJob: (job) => set({ currentJob: job }),
  costEstimate: null,
  setCostEstimate: (costEstimate) => set({ costEstimate }),
  reset: () => set((s) => {
    const snapshots = s.sessionImages.length > 0 ? s.sessionImages.map(cloneImageInfo) : s.currentImage ? [cloneImageInfo(s.currentImage)] : [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newEntries = snapshots.map((image, i) => ({
      key: `${Date.now()}-${i}-${image.id}`,
      archivedAt: now,
      image
    }));
    const archivedWorkspaceImages = [...newEntries, ...s.archivedWorkspaceImages].slice(
      0,
      MAX_WORKSPACE_ARCHIVE
    );
    persistWorkspaceArchive(archivedWorkspaceImages);
    return {
      currentImage: null,
      sessionImages: [],
      currentJob: null,
      costEstimate: null,
      archivedWorkspaceImages,
      workspaceMode: s.workspaceMode,
      provider: "improve",
      model: "browser",
      openaiModelPref: s.openaiModelPref,
      geminiModelPref: s.geminiModelPref,
      lighting: "bright",
      qualityPreset: "full_enhance",
      perspective: "straighten",
      roomType: "general",
      customPrompt: null,
      quality: "high",
      scaleFactor: 2,
      targetResolution: "4k",
      outputFormat: "png"
    };
  }),
  applyPipelineExperienceTier: (tier) => {
    if (tier === 1) {
      set({
        lighting: "bright",
        qualityPreset: "full_enhance",
        perspective: "straighten",
        roomType: "general",
        quality: "high",
        scaleFactor: 2,
        targetResolution: "4k",
        outputFormat: "png"
      });
      return;
    }
    set({
      lighting: "natural",
      qualityPreset: "full_enhance",
      perspective: "align_verticals_auto",
      roomType: "general",
      quality: "high",
      scaleFactor: 3,
      targetResolution: "4k",
      outputFormat: "png"
    });
  }
}));
export {
  useImageStore
};

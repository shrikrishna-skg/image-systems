import { create } from "zustand";
import type { ImageInfo, JobInfo, CostEstimate } from "../types";
import { MAX_WORKSPACE_ASSETS } from "../lib/workspaceLimits";

export interface AddSessionImagesResult {
  added: number;
  droppedDueToCapacity: number;
  duplicatesSkipped: number;
}

const ARCHIVE_STORAGE_KEY = "iep-workspace-archive-v1";
const WORKSPACE_MODE_KEY = "iep-workspace-mode-v1";
const MAX_WORKSPACE_ARCHIVE = 48;

function loadWorkspaceModePreference(): boolean {
  try {
    return localStorage.getItem(WORKSPACE_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistWorkspaceModePreference(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(WORKSPACE_MODE_KEY, "1");
    else localStorage.removeItem(WORKSPACE_MODE_KEY);
  } catch {
    /* private mode */
  }
}

export interface ArchivedWorkspaceImage {
  key: string;
  archivedAt: string;
  image: ImageInfo;
}

function cloneImageInfo(img: ImageInfo): ImageInfo {
  return {
    ...img,
    versions: img.versions.map((v) => ({ ...v })),
  };
}

function loadWorkspaceArchive(): ArchivedWorkspaceImage[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is ArchivedWorkspaceImage =>
        row != null &&
        typeof row === "object" &&
        typeof (row as ArchivedWorkspaceImage).key === "string" &&
        typeof (row as ArchivedWorkspaceImage).archivedAt === "string" &&
        (row as ArchivedWorkspaceImage).image != null &&
        typeof (row as ArchivedWorkspaceImage).image.id === "string"
    );
  } catch {
    return [];
  }
}

function persistWorkspaceArchive(rows: ArchivedWorkspaceImage[]) {
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* quota / private mode */
  }
}

interface ImageState {
  // Current working image
  currentImage: ImageInfo | null;
  setCurrentImage: (image: ImageInfo | null) => void;

  /** Batch session: all assets imported in this workspace (deduped by id). */
  sessionImages: ImageInfo[];
  addImagesToSession: (images: ImageInfo[]) => AddSessionImagesResult;
  upsertSessionImage: (image: ImageInfo) => void;
  removeSessionImage: (id: string) => void;
  /** Replace queue (e.g. open one asset from history). */
  replaceSessionWith: (images: ImageInfo[]) => void;

  /** Snapshots from cleared workspace (persisted); originals stay in History / IndexedDB. */
  archivedWorkspaceImages: ArchivedWorkspaceImage[];
  removeArchivedWorkspaceImage: (key: string) => void;
  clearWorkspaceArchive: () => void;
  /** Load one archived snapshot back into the session (removes that archive row). False if workspace full. */
  restoreArchivedWorkspaceImage: (key: string) => boolean;

  /**
   * When false (default): one photo at a time, no batch queue UI.
   * When true: multi-asset workspace (up to MAX_WORKSPACE_ASSETS), batch tools, archive strip.
   */
  workspaceMode: boolean;
  setWorkspaceMode: (enabled: boolean) => void;
  /** Standard import: replace the single working image; clears queue and job. */
  setStandardImport: (image: ImageInfo) => void;

  // Enhancement settings
  provider: string;
  model: string;
  lighting: string | null;
  qualityPreset: string | null;
  perspective: string | null;
  roomType: string;
  customPrompt: string | null;
  quality: string;
  scaleFactor: number;
  targetResolution: string;
  outputFormat: string;

  // Setters
  setProvider: (p: string) => void;
  setModel: (m: string) => void;
  setLighting: (l: string | null) => void;
  setQualityPreset: (q: string | null) => void;
  setPerspective: (p: string | null) => void;
  setRoomType: (r: string) => void;
  setCustomPrompt: (p: string | null) => void;
  setQuality: (q: string) => void;
  setScaleFactor: (s: number) => void;
  setTargetResolution: (r: string) => void;
  setOutputFormat: (f: string) => void;

  // Job tracking
  currentJob: JobInfo | null;
  setCurrentJob: (job: JobInfo | null) => void;

  // Cost estimate
  costEstimate: CostEstimate | null;
  setCostEstimate: (cost: CostEstimate | null) => void;

  // Reset
  reset: () => void;

  /** Classic (1) vs adaptive calibrated (2) default tuning — see Settings → Adaptive workspace. */
  applyPipelineExperienceTier: (tier: 1 | 2) => void;
}

export const useImageStore = create<ImageState>((set) => ({
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
          currentJob: null,
        };
      }
      if (s.sessionImages.length === 0 && s.currentImage) {
        return {
          workspaceMode: true,
          sessionImages: [s.currentImage],
          currentImage: s.currentImage,
        };
      }
      return { workspaceMode: true };
    });
  },
  setStandardImport: (image) =>
    set({
      sessionImages: [],
      currentImage: image,
      currentJob: null,
    }),

  currentImage: null,
  setCurrentImage: (image) => set({ currentImage: image }),

  sessionImages: [],
  addImagesToSession: (incoming) => {
    const result: AddSessionImagesResult = { added: 0, droppedDueToCapacity: 0, duplicatesSkipped: 0 };
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
      const newCurrent =
        cur && curStillThere
          ? cur
          : incoming.find((img) => next.some((x) => x.id === img.id)) ?? next[0] ?? null;
      return {
        sessionImages: next,
        currentImage: newCurrent,
      };
    });
    return result;
  },
  upsertSessionImage: (image) =>
    set((s) => ({
      sessionImages: s.sessionImages.map((i) => (i.id === image.id ? image : i)),
      currentImage: s.currentImage?.id === image.id ? image : s.currentImage,
    })),
  removeSessionImage: (id) =>
    set((s) => {
      const next = s.sessionImages.filter((i) => i.id !== id);
      const cur = s.currentImage;
      const nextCurrent = cur?.id === id ? next[0] ?? null : cur;
      return { sessionImages: next, currentImage: nextCurrent };
    }),
  replaceSessionWith: (images) =>
    set((s) => {
      const slice = images.slice(0, MAX_WORKSPACE_ASSETS);
      const first = slice[0] ?? null;
      if (!s.workspaceMode) {
        return {
          sessionImages: [],
          currentImage: first,
          currentJob: null,
        };
      }
      return {
        sessionImages: slice,
        currentImage: first,
        currentJob: null,
      };
    }),

  removeArchivedWorkspaceImage: (key) =>
    set((s) => {
      const archivedWorkspaceImages = s.archivedWorkspaceImages.filter((e) => e.key !== key);
      persistWorkspaceArchive(archivedWorkspaceImages);
      return { archivedWorkspaceImages };
    }),

  clearWorkspaceArchive: () =>
    set(() => {
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
      if (
        s.workspaceMode &&
        !already &&
        s.sessionImages.length >= MAX_WORKSPACE_ASSETS
      ) {
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
          currentJob: null,
        };
      }
      const sessionImages =
        s.sessionImages.length === 0
          ? [img]
          : already
            ? s.sessionImages.map((i) => (i.id === img.id ? img : i))
            : [...s.sessionImages, img];
      return {
        archivedWorkspaceImages,
        sessionImages,
        currentImage: img,
        currentJob: null,
      };
    });
    return ok;
  },

  provider: "improve",
  model: "browser",
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
    let model = "gpt-image-1";
    if (provider === "gemini") model = "gemini-2.0-flash-exp-image-generation";
    if (provider === "improve") model = "browser";
    set({ provider, model });
  },
  setModel: (model) => set({ model }),
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

  reset: () =>
    set((s) => {
      const snapshots: ImageInfo[] =
        s.sessionImages.length > 0
          ? s.sessionImages.map(cloneImageInfo)
          : s.currentImage
            ? [cloneImageInfo(s.currentImage)]
            : [];
      const now = new Date().toISOString();
      const newEntries: ArchivedWorkspaceImage[] = snapshots.map((image, i) => ({
        key: `${Date.now()}-${i}-${image.id}`,
        archivedAt: now,
        image,
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
        lighting: "bright",
        qualityPreset: "full_enhance",
        perspective: "straighten",
        roomType: "general",
        customPrompt: null,
        quality: "high",
        scaleFactor: 2,
        targetResolution: "4k",
        outputFormat: "png",
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
        outputFormat: "png",
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
      outputFormat: "png",
    });
  },
}));

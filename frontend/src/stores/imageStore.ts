import { create } from "zustand";
import type { ImageInfo, JobInfo, CostEstimate } from "../types";

interface ImageState {
  // Current working image
  currentImage: ImageInfo | null;
  setCurrentImage: (image: ImageInfo | null) => void;

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
}

export const useImageStore = create<ImageState>((set) => ({
  currentImage: null,
  setCurrentImage: (image) => set({ currentImage: image }),

  provider: "openai",
  model: "gpt-image-1",
  lighting: "bright",
  qualityPreset: "full_enhance",
  perspective: null,
  roomType: "general",
  customPrompt: null,
  quality: "high",
  scaleFactor: 2,
  targetResolution: "4k",
  outputFormat: "png",

  setProvider: (provider) => {
    const model = provider === "openai" ? "gpt-image-1" : "gemini-2.0-flash-exp-image-generation";
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
    set({
      currentImage: null,
      currentJob: null,
      costEstimate: null,
      provider: "openai",
      model: "gpt-image-1",
      lighting: "bright",
      qualityPreset: "full_enhance",
      perspective: null,
      roomType: "general",
      customPrompt: null,
      quality: "high",
      scaleFactor: 2,
      targetResolution: "4k",
      outputFormat: "png",
    }),
}));

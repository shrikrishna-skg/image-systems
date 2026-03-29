import { create } from "zustand";
import { calibrationReadinessPercent, isCalibrationComplete } from "../lib/adaptiveCalibration";
import {
  clampCalibrationSignalWeight,
  defaultAdaptiveExperiencePersisted,
  normalizeAdaptiveExperiencePersisted,
  shouldOfferAdaptiveUpgrade
} from "../lib/adaptiveExperienceModel";
import { useImageStore } from "./imageStore";
import { toast } from "sonner";
const STORAGE_KEY = "iep-adaptive-experience-v1";
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultAdaptiveExperiencePersisted };
    const parsed = JSON.parse(raw);
    return normalizeAdaptiveExperiencePersisted(parsed);
  } catch {
    return { ...defaultAdaptiveExperiencePersisted };
  }
}
function save(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
  }
}
function sliceState(s) {
  return {
    calibrationMass: s.calibrationMass,
    observedCompletionCount: s.observedCompletionCount,
    pinToClassicExperience: s.pinToClassicExperience,
    experienceTier: s.experienceTier,
    upgradePromptDismissed: s.upgradePromptDismissed,
    hasShownCalibrationReadyToast: s.hasShownCalibrationReadyToast
  };
}
const useAdaptiveExperienceStore = create((set, get) => ({
  ...load(),
  getReadinessPercent: () => calibrationReadinessPercent(get().calibrationMass),
  getShouldOfferUpgrade: () => {
    const s = get();
    return shouldOfferAdaptiveUpgrade({
      calibrationMass: s.calibrationMass,
      experienceTier: s.experienceTier,
      pinToClassicExperience: s.pinToClassicExperience
    });
  },
  recordCalibrationSignal: (weight) => {
    const w = clampCalibrationSignalWeight(weight);
    if (w <= 0) return;
    set((prev) => {
      const calibrationMass = prev.calibrationMass + w;
      const observedCompletionCount = prev.observedCompletionCount + 1;
      const next = { ...prev, calibrationMass, observedCompletionCount };
      save(sliceState(next));
      return next;
    });
    const after = get();
    if (isCalibrationComplete(after.calibrationMass) && !after.pinToClassicExperience && after.experienceTier === 1 && !after.hasShownCalibrationReadyToast) {
      set((p) => {
        const u = { ...p, hasShownCalibrationReadyToast: true };
        save(sliceState(u));
        return u;
      });
      toast.success("Workspace calibrated", {
        description: "Weighted signals from your runs reached full confidence. Review Adaptive workspace in Settings."
      });
    }
  },
  setPinToClassicExperience: (pinned) => {
    set((p) => {
      const next = { ...p, pinToClassicExperience: pinned };
      save(sliceState(next));
      return next;
    });
  },
  dismissUpgradePrompt: () => {
    set((p) => {
      const next = { ...p, upgradePromptDismissed: true };
      save(sliceState(next));
      return next;
    });
  },
  applyAdaptiveUpgrade: () => {
    set((p) => {
      const next = {
        ...p,
        experienceTier: 2,
        upgradePromptDismissed: true
      };
      save(sliceState(next));
      return next;
    });
    useImageStore.getState().applyPipelineExperienceTier(2);
    toast.success("Adaptive experience on", {
      description: "Tier 2 defaults are active\u2014tuned lighting, smart perspective, and upscale. Roll back anytime in Settings."
    });
  },
  rollbackToClassicExperience: () => {
    set((p) => {
      const next = {
        ...p,
        experienceTier: 1,
        pinToClassicExperience: true,
        upgradePromptDismissed: false
      };
      save(sliceState(next));
      return next;
    });
    useImageStore.getState().applyPipelineExperienceTier(1);
    toast.success("Rolled back to classic pipeline defaults (pinned).");
  }
}));
export {
  useAdaptiveExperienceStore
};

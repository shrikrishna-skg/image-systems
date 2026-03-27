import { create } from "zustand";
import { calibrationReadinessPercent, isCalibrationComplete } from "../lib/adaptiveCalibration";
import { useImageStore } from "./imageStore";
import { toast } from "sonner";

const STORAGE_KEY = "iep-adaptive-experience-v1";

export type ExperienceTier = 1 | 2;

export interface AdaptiveExperiencePersisted {
  /** Sum of weighted completion signals (target ≈ CALIBRATION_TARGET_UNITS for tier offer). */
  calibrationMass: number;
  /** Raw count of deduped job completions (for transparency). */
  observedCompletionCount: number;
  pinToClassicExperience: boolean;
  experienceTier: ExperienceTier;
  upgradePromptDismissed: boolean;
  hasShownCalibrationReadyToast: boolean;
}

const defaultPersisted: AdaptiveExperiencePersisted = {
  calibrationMass: 0,
  observedCompletionCount: 0,
  pinToClassicExperience: false,
  experienceTier: 1,
  upgradePromptDismissed: false,
  hasShownCalibrationReadyToast: false,
};

type LegacyParsed = Partial<AdaptiveExperiencePersisted> & { successfulPipelineRuns?: number };

function normalizeFromStorage(parsed: LegacyParsed | null): AdaptiveExperiencePersisted {
  if (!parsed) return { ...defaultPersisted };

  let calibrationMass =
    typeof parsed.calibrationMass === "number" && Number.isFinite(parsed.calibrationMass)
      ? Math.max(0, parsed.calibrationMass)
      : 0;
  let observedCompletionCount =
    typeof parsed.observedCompletionCount === "number" && Number.isFinite(parsed.observedCompletionCount)
      ? Math.max(0, Math.floor(parsed.observedCompletionCount))
      : 0;

  const legacyRuns = parsed.successfulPipelineRuns;
  if (calibrationMass === 0 && typeof legacyRuns === "number" && legacyRuns > 0 && Number.isFinite(legacyRuns)) {
    calibrationMass = legacyRuns;
    if (observedCompletionCount === 0) observedCompletionCount = Math.floor(legacyRuns);
  }

  return {
    ...defaultPersisted,
    ...parsed,
    calibrationMass,
    observedCompletionCount,
  };
}

function load(): AdaptiveExperiencePersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultPersisted };
    const parsed = JSON.parse(raw) as LegacyParsed;
    return normalizeFromStorage(parsed);
  } catch {
    return { ...defaultPersisted };
  }
}

function save(p: AdaptiveExperiencePersisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode */
  }
}

interface AdaptiveExperienceState extends AdaptiveExperiencePersisted {
  /** Weighted signal from one deduped job completion (see adaptiveCalibration). */
  recordCalibrationSignal: (weight: number) => void;
  setPinToClassicExperience: (pinned: boolean) => void;
  dismissUpgradePrompt: () => void;
  applyAdaptiveUpgrade: () => void;
  rollbackToClassicExperience: () => void;
  getReadinessPercent: () => number;
  getShouldOfferUpgrade: () => boolean;
}

function sliceState(s: AdaptiveExperienceState): AdaptiveExperiencePersisted {
  return {
    calibrationMass: s.calibrationMass,
    observedCompletionCount: s.observedCompletionCount,
    pinToClassicExperience: s.pinToClassicExperience,
    experienceTier: s.experienceTier,
    upgradePromptDismissed: s.upgradePromptDismissed,
    hasShownCalibrationReadyToast: s.hasShownCalibrationReadyToast,
  };
}

export const useAdaptiveExperienceStore = create<AdaptiveExperienceState>((set, get) => ({
  ...load(),

  getReadinessPercent: () => calibrationReadinessPercent(get().calibrationMass),

  getShouldOfferUpgrade: () => {
    const s = get();
    return (
      isCalibrationComplete(s.calibrationMass) &&
      s.experienceTier === 1 &&
      !s.pinToClassicExperience
    );
  },

  recordCalibrationSignal: (weight: number) => {
    const w = Math.max(0, Math.min(2.75, Number(weight)));
    if (!Number.isFinite(w) || w <= 0) return;

    set((prev) => {
      const calibrationMass = prev.calibrationMass + w;
      const observedCompletionCount = prev.observedCompletionCount + 1;
      const next = { ...prev, calibrationMass, observedCompletionCount };
      save(sliceState(next));
      return next;
    });

    const after = get();
    if (
      isCalibrationComplete(after.calibrationMass) &&
      !after.pinToClassicExperience &&
      after.experienceTier === 1 &&
      !after.hasShownCalibrationReadyToast
    ) {
      set((p) => {
        const u = { ...p, hasShownCalibrationReadyToast: true };
        save(sliceState(u));
        return u;
      });
      toast.success("Workspace calibrated", {
        description: "Weighted signals from your runs reached full confidence. Review Adaptive workspace in Settings.",
        duration: 7000,
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
        experienceTier: 2 as ExperienceTier,
        upgradePromptDismissed: true,
      };
      save(sliceState(next));
      return next;
    });
    useImageStore.getState().applyPipelineExperienceTier(2);
    toast.success("Adaptive experience on", {
      description: "Tier 2 defaults are active—tuned lighting, smart perspective, and upscale. Roll back anytime in Settings.",
      duration: 6500,
    });
  },

  rollbackToClassicExperience: () => {
    set((p) => {
      const next = {
        ...p,
        experienceTier: 1 as ExperienceTier,
        pinToClassicExperience: true,
        upgradePromptDismissed: false,
      };
      save(sliceState(next));
      return next;
    });
    useImageStore.getState().applyPipelineExperienceTier(1);
    toast.success("Rolled back to classic pipeline defaults (pinned).");
  },
}));

import { describe, expect, it } from "vitest";
import {
  CALIBRATION_SIGNAL_WEIGHT_MAX,
  clampCalibrationSignalWeight,
  defaultAdaptiveExperiencePersisted,
  normalizeAdaptiveExperiencePersisted,
  shouldOfferAdaptiveUpgrade
} from "./adaptiveExperienceModel";
describe("adaptiveExperienceModel", () => {
  describe("normalizeAdaptiveExperiencePersisted", () => {
    it("returns defaults for non-objects", () => {
      expect(normalizeAdaptiveExperiencePersisted(null)).toEqual(defaultAdaptiveExperiencePersisted);
      expect(normalizeAdaptiveExperiencePersisted(void 0)).toEqual(defaultAdaptiveExperiencePersisted);
      expect(normalizeAdaptiveExperiencePersisted("x")).toEqual(defaultAdaptiveExperiencePersisted);
    });
    it("floors negative / non-finite mass and count", () => {
      const out = normalizeAdaptiveExperiencePersisted({
        calibrationMass: -3,
        observedCompletionCount: 2.9
      });
      expect(out.calibrationMass).toBe(0);
      expect(out.observedCompletionCount).toBe(2);
    });
    it("migrates legacy successfulPipelineRuns when mass was zero", () => {
      const out = normalizeAdaptiveExperiencePersisted({
        successfulPipelineRuns: 5,
        observedCompletionCount: 0
      });
      expect(out.calibrationMass).toBe(5);
      expect(out.observedCompletionCount).toBe(5);
    });
    it("does not override explicit mass with legacy runs", () => {
      const out = normalizeAdaptiveExperiencePersisted({
        calibrationMass: 3,
        successfulPipelineRuns: 99
      });
      expect(out.calibrationMass).toBe(3);
    });
    it("preserves other persisted flags when present", () => {
      const out = normalizeAdaptiveExperiencePersisted({
        pinToClassicExperience: true,
        experienceTier: 2,
        upgradePromptDismissed: true
      });
      expect(out.pinToClassicExperience).toBe(true);
      expect(out.experienceTier).toBe(2);
      expect(out.upgradePromptDismissed).toBe(true);
    });
  });
  describe("clampCalibrationSignalWeight", () => {
    it("returns 0 for invalid input", () => {
      expect(clampCalibrationSignalWeight(NaN)).toBe(0);
      expect(clampCalibrationSignalWeight(-1)).toBe(0);
      expect(clampCalibrationSignalWeight(0)).toBe(0);
      expect(clampCalibrationSignalWeight("x")).toBe(0);
    });
    it("clamps to max", () => {
      expect(clampCalibrationSignalWeight(1)).toBe(1);
      expect(clampCalibrationSignalWeight(CALIBRATION_SIGNAL_WEIGHT_MAX)).toBe(CALIBRATION_SIGNAL_WEIGHT_MAX);
      expect(clampCalibrationSignalWeight(99)).toBe(CALIBRATION_SIGNAL_WEIGHT_MAX);
    });
  });
  describe("shouldOfferAdaptiveUpgrade", () => {
    it("requires full calibration, tier 1, not pinned", () => {
      expect(
        shouldOfferAdaptiveUpgrade({
          calibrationMass: 12,
          experienceTier: 1,
          pinToClassicExperience: false
        })
      ).toBe(true);
      expect(
        shouldOfferAdaptiveUpgrade({
          calibrationMass: 11.9,
          experienceTier: 1,
          pinToClassicExperience: false
        })
      ).toBe(false);
      expect(
        shouldOfferAdaptiveUpgrade({
          calibrationMass: 12,
          experienceTier: 2,
          pinToClassicExperience: false
        })
      ).toBe(false);
      expect(
        shouldOfferAdaptiveUpgrade({
          calibrationMass: 12,
          experienceTier: 1,
          pinToClassicExperience: true
        })
      ).toBe(false);
    });
  });
});

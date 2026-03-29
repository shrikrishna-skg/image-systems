import { isCalibrationComplete } from "./adaptiveCalibration";
const defaultAdaptiveExperiencePersisted = {
  calibrationMass: 0,
  observedCompletionCount: 0,
  pinToClassicExperience: false,
  experienceTier: 1,
  upgradePromptDismissed: false,
  hasShownCalibrationReadyToast: false
};
const CALIBRATION_SIGNAL_WEIGHT_MAX = 2.75;
function clampCalibrationSignalWeight(weight) {
  const n = Number(weight);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.min(CALIBRATION_SIGNAL_WEIGHT_MAX, n));
}
function shouldOfferAdaptiveUpgrade(s) {
  return isCalibrationComplete(s.calibrationMass) && s.experienceTier === 1 && !s.pinToClassicExperience;
}
function normalizeAdaptiveExperiencePersisted(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { ...defaultAdaptiveExperiencePersisted };
  }
  const p = parsed;
  let calibrationMass = typeof p.calibrationMass === "number" && Number.isFinite(p.calibrationMass) ? Math.max(0, p.calibrationMass) : 0;
  let observedCompletionCount = typeof p.observedCompletionCount === "number" && Number.isFinite(p.observedCompletionCount) ? Math.max(0, Math.floor(p.observedCompletionCount)) : 0;
  const legacyRuns = p.successfulPipelineRuns;
  if (calibrationMass === 0 && typeof legacyRuns === "number" && legacyRuns > 0 && Number.isFinite(legacyRuns)) {
    calibrationMass = legacyRuns;
    if (observedCompletionCount === 0) observedCompletionCount = Math.floor(legacyRuns);
  }
  return {
    ...defaultAdaptiveExperiencePersisted,
    ...p,
    calibrationMass,
    observedCompletionCount
  };
}
export {
  CALIBRATION_SIGNAL_WEIGHT_MAX,
  clampCalibrationSignalWeight,
  defaultAdaptiveExperiencePersisted,
  normalizeAdaptiveExperiencePersisted,
  shouldOfferAdaptiveUpgrade
};

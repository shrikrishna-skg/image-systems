const CALIBRATION_TARGET_UNITS = 12;
const RUNS_FOR_FULL_CALIBRATION = CALIBRATION_TARGET_UNITS;
function resolveCalibrationProviderKind(provider) {
  if (provider === "improve") return "improve";
  if (provider === "openai" || provider === "gemini") return "cloud";
  return "unknown";
}
function calibrationIncrementForCompletion(jobType, providerKind) {
  const full = jobType === "full_pipeline";
  const enhance = jobType === "enhance";
  const upscale = jobType === "upscale";
  if (full && providerKind === "cloud") return 1.45;
  if (full && providerKind === "improve") return 1.12;
  if (full) return 1.18;
  if (enhance && providerKind === "cloud") return 0.78;
  if (enhance) return 0.68;
  if (upscale) return 0.42;
  return 1;
}
function calibrationReadinessPercent(calibrationMass) {
  if (calibrationMass <= 0) return 0;
  return Math.min(100, Math.round(calibrationMass / CALIBRATION_TARGET_UNITS * 100));
}
function isCalibrationComplete(calibrationMass) {
  return calibrationReadinessPercent(calibrationMass) >= 100;
}
export {
  CALIBRATION_TARGET_UNITS,
  RUNS_FOR_FULL_CALIBRATION,
  calibrationIncrementForCompletion,
  calibrationReadinessPercent,
  isCalibrationComplete,
  resolveCalibrationProviderKind
};

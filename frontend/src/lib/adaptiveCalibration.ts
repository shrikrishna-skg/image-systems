/**
 * Workspace calibration — confidence from observed successful runs with weighted signals.
 * Stronger runs (full cloud pipeline) advance readiness faster than partial steps; local /
 * improve runs still count but reflect a slightly different trust profile.
 * Does not train foundation models; only unlocks tier-2 curated defaults.
 */

export const CALIBRATION_TARGET_UNITS = 12;

/** @deprecated use CALIBRATION_TARGET_UNITS */
export const RUNS_FOR_FULL_CALIBRATION = CALIBRATION_TARGET_UNITS;

export type CalibrationProviderKind = "cloud" | "improve" | "unknown";

export function resolveCalibrationProviderKind(provider: string): CalibrationProviderKind {
  if (provider === "improve") return "improve";
  if (provider === "openai" || provider === "gemini") return "cloud";
  return "unknown";
}

/**
 * Weight applied once per completed job (after dedupe). Cloud full pipelines are the
 * strongest evidence; enhance-only or upscale-only are partial signals.
 */
export function calibrationIncrementForCompletion(
  jobType: string,
  providerKind: CalibrationProviderKind
): number {
  const full = jobType === "full_pipeline";
  const enhance = jobType === "enhance";
  const upscale = jobType === "upscale";

  if (full && providerKind === "cloud") return 1.45;
  if (full && providerKind === "improve") return 1.12;
  if (full) return 1.18;
  if (enhance && providerKind === "cloud") return 0.78;
  if (enhance) return 0.68;
  if (upscale) return 0.42;
  return 1.0;
}

export function calibrationReadinessPercent(calibrationMass: number): number {
  if (calibrationMass <= 0) return 0;
  return Math.min(100, Math.round((calibrationMass / CALIBRATION_TARGET_UNITS) * 100));
}

export function isCalibrationComplete(calibrationMass: number): boolean {
  return calibrationReadinessPercent(calibrationMass) >= 100;
}

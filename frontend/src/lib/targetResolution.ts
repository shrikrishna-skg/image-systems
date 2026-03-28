/** Mirrors backend calculate_target_resolution / normalize_target_resolution_key for UI preview. */

export function calculateTargetDimensions(
  w: number,
  h: number,
  target: string | null | undefined
): { width: number; height: number } | null {
  const t = (target ?? "").toLowerCase().trim().replace(/\s/g, "").replace(/_/g, "");
  const targets: Record<string, number> = {
    "1080p": 1920,
    "2k": 2560,
    "4k": 3840,
    "8k": 7680,
  };
  const maxDim = targets[t];
  if (maxDim == null || w < 1 || h < 1) return null;
  const ratio = w / h;
  if (ratio >= 1) {
    return { width: maxDim, height: Math.round(maxDim / ratio) };
  }
  return { width: Math.round(maxDim * ratio), height: maxDim };
}

export function expectedUpscaleOutputSize(
  ow: number,
  oh: number,
  targetResolution: string | null | undefined,
  scaleFactor: number
): { width: number; height: number; mode: "target" | "scale" } {
  const td = calculateTargetDimensions(ow, oh, targetResolution);
  if (td) return { ...td, mode: "target" };
  return {
    width: Math.round(ow * scaleFactor),
    height: Math.round(oh * scaleFactor),
    mode: "scale",
  };
}

import { upscaleDimensionsWithinCap } from "./canvasSafe";
function expectedBrowserImproveOutputSize(ow, oh, scaleFactor) {
  const { w, h } = upscaleDimensionsWithinCap(ow, oh, scaleFactor);
  return { width: w, height: h };
}
function calculateTargetDimensions(w, h, target) {
  const t = (target ?? "").toLowerCase().trim().replace(/\s/g, "").replace(/_/g, "");
  const targets = {
    "1080p": 1920,
    "2k": 2560,
    "4k": 3840,
    "8k": 7680
  };
  const maxDim = targets[t];
  if (maxDim == null || w < 1 || h < 1) return null;
  const ratio = w / h;
  if (ratio >= 1) {
    return { width: maxDim, height: Math.round(maxDim / ratio) };
  }
  return { width: Math.round(maxDim * ratio), height: maxDim };
}
function expectedImproveDeliveredSize(ow, oh, scaleFactor, targetResolution) {
  const scaled = expectedBrowserImproveOutputSize(ow, oh, scaleFactor);
  const td = calculateTargetDimensions(scaled.width, scaled.height, targetResolution);
  return td ?? scaled;
}
function expectedUpscaleOutputSize(ow, oh, targetResolution, scaleFactor) {
  const td = calculateTargetDimensions(ow, oh, targetResolution);
  if (td) return { ...td, mode: "target" };
  return {
    width: Math.round(ow * scaleFactor),
    height: Math.round(oh * scaleFactor),
    mode: "scale"
  };
}
export {
  calculateTargetDimensions,
  expectedBrowserImproveOutputSize,
  expectedImproveDeliveredSize,
  expectedUpscaleOutputSize
};

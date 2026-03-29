const MAX_CANVAS_PIXELS = 1e8;
function clampDimensionsToMaxPixels(w, h, maxPx = MAX_CANVAS_PIXELS) {
  if (w <= 0 || h <= 0) return { w: 1, h: 1 };
  if (w * h <= maxPx) return { w, h };
  const scale = Math.sqrt(maxPx / (w * h));
  return {
    w: Math.max(1, Math.floor(w * scale)),
    h: Math.max(1, Math.floor(h * scale))
  };
}
function upscaleDimensionsWithinCap(srcW, srcH, requestedScale, maxPx = MAX_CANVAS_PIXELS) {
  const cappedRequest = Math.min(4, Math.max(1, requestedScale));
  const w = Math.round(srcW * cappedRequest);
  const h = Math.round(srcH * cappedRequest);
  if (w * h <= maxPx) {
    return { w, h, effectiveScale: cappedRequest };
  }
  const { w: cw, h: ch } = clampDimensionsToMaxPixels(w, h, maxPx);
  const effectiveScale = srcW > 0 ? cw / srcW : cappedRequest;
  return { w: cw, h: ch, effectiveScale };
}
export {
  MAX_CANVAS_PIXELS,
  clampDimensionsToMaxPixels,
  upscaleDimensionsWithinCap
};

/**
 * Browser canvas backing stores are limited (Chromium ~268M pixels; Safari / iOS often stricter).
 * Large DSLR / "8K-class" frames × 4× upscale exceed limits and throw or return null from toBlob.
 */
export const MAX_CANVAS_PIXELS = 100_000_000;

export function clampDimensionsToMaxPixels(
  w: number,
  h: number,
  maxPx: number = MAX_CANVAS_PIXELS
): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 1, h: 1 };
  if (w * h <= maxPx) return { w, h };
  const scale = Math.sqrt(maxPx / (w * h));
  return {
    w: Math.max(1, Math.floor(w * scale)),
    h: Math.max(1, Math.floor(h * scale)),
  };
}

/** Target upscale size capped so width×height stays within MAX_CANVAS_PIXELS. */
export function upscaleDimensionsWithinCap(
  srcW: number,
  srcH: number,
  requestedScale: number,
  maxPx: number = MAX_CANVAS_PIXELS
): { w: number; h: number; effectiveScale: number } {
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

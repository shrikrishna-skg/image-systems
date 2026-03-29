import { describe, expect, it } from "vitest";
import { clampDimensionsToMaxPixels, MAX_CANVAS_PIXELS, upscaleDimensionsWithinCap } from "./canvasSafe";
describe("Phase 9 \u2014 canvas safe dimensions", () => {
  it("clampDimensionsToMaxPixels returns 1x1 for non-positive input", () => {
    expect(clampDimensionsToMaxPixels(0, 100)).toEqual({ w: 1, h: 1 });
    expect(clampDimensionsToMaxPixels(10, -1)).toEqual({ w: 1, h: 1 });
  });
  it("preserves dimensions when under cap", () => {
    expect(clampDimensionsToMaxPixels(800, 600, MAX_CANVAS_PIXELS)).toEqual({ w: 800, h: 600 });
  });
  it("scales down huge rasters to respect maxPx", () => {
    const { w, h } = clampDimensionsToMaxPixels(5e4, 5e4, 1e6);
    expect(w * h).toBeLessThanOrEqual(1e6);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });
  it("upscaleDimensionsWithinCap clamps effective scale when product exceeds maxPx", () => {
    const out = upscaleDimensionsWithinCap(1e4, 1e4, 4, 1e6);
    expect(out.w * out.h).toBeLessThanOrEqual(1e6);
    expect(out.effectiveScale).toBeLessThan(4);
  });
});

import { describe, expect, it } from "vitest";
import {
  LISTING_RECENTER_PASSES,
  listingAngleUsesHorizontalRecenter,
  listingHeroCentroidProfile,
  listingRecenterMaxShiftRatio,
  perspectiveUsesRotatedQuad,
  usesChangeAngleSobel
} from "./localEnhancePolicy";
describe("Phase 9 \u2014 localEnhance policy (Sobel / quad / recenter)", () => {
  it("usesChangeAngleSobel is true for listing family + legacy auto", () => {
    for (const p of ["center_angle_auto", "center_angle", "change_angle_front", "change_angle_side"]) {
      expect(usesChangeAngleSobel(p)).toBe(true);
    }
    expect(usesChangeAngleSobel("align_verticals_auto")).toBe(false);
    expect(usesChangeAngleSobel(null)).toBe(false);
  });
  it("perspectiveUsesRotatedQuad includes geometry, listing Sobel family, and straighten", () => {
    expect(perspectiveUsesRotatedQuad("align_verticals_auto")).toBe(true);
    expect(perspectiveUsesRotatedQuad("level_horizon_auto")).toBe(true);
    expect(perspectiveUsesRotatedQuad("change_angle_side")).toBe(true);
    expect(perspectiveUsesRotatedQuad("straighten")).toBe(true);
    expect(perspectiveUsesRotatedQuad("correct_distortion")).toBe(false);
    expect(perspectiveUsesRotatedQuad(null)).toBe(false);
  });
  it("listingAngleUsesHorizontalRecenter matches listing modes only", () => {
    for (const p of ["center_angle", "change_angle_front", "change_angle_side", "center_angle_auto"]) {
      expect(listingAngleUsesHorizontalRecenter(p)).toBe(true);
    }
    expect(listingAngleUsesHorizontalRecenter("align_verticals_auto")).toBe(false);
  });
  it("listingRecenterMaxShiftRatio: side/auto largest, front smallest among listing", () => {
    expect(listingRecenterMaxShiftRatio("change_angle_side")).toBe(0.4);
    expect(listingRecenterMaxShiftRatio("center_angle_auto")).toBe(0.4);
    expect(listingRecenterMaxShiftRatio("center_angle")).toBe(0.38);
    expect(listingRecenterMaxShiftRatio("change_angle_front")).toBe(0.36);
    expect(listingRecenterMaxShiftRatio("align_verticals_auto")).toBe(0.32);
  });
  it("LISTING_RECENTER_PASSES is stable (multi-pass horizontal nudge)", () => {
    expect(LISTING_RECENTER_PASSES).toBe(4);
  });
  it("listingHeroCentroidProfile down-weights lower rows for side vs default", () => {
    const side = listingHeroCentroidProfile("change_angle_side");
    const def = listingHeroCentroidProfile("align_verticals_auto");
    expect(side.lowerRowScale).toBeLessThan(def.lowerRowScale);
    expect(side.dominanceYEndRatio).toBeLessThan(def.dominanceYEndRatio);
  });
});

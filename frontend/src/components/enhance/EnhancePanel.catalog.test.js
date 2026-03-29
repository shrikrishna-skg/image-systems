import { describe, expect, it } from "vitest";
import { PERSPECTIVE_OPTIONS, PERSPECTIVE_SECTION_LABELS } from "./enhancePanelCatalog";
describe("Phase 10 \u2014 Enhance panel catalog invariants", () => {
  it("exports every backend-valid listing perspective in the UI", () => {
    const values = PERSPECTIVE_OPTIONS.map((o) => o.value).filter((v) => v != null);
    for (const required of ["center_angle", "change_angle_front", "change_angle_side"]) {
      expect(values).toContain(required);
    }
  });
  it("listing section copy mentions spatial fidelity themes (doorways, gaps, no new objects)", () => {
    const listing = PERSPECTIVE_SECTION_LABELS.listing.description.toLowerCase();
    expect(listing).toMatch(/doorway|doorways/);
    expect(listing).toMatch(/gap|empty/);
    expect(listing).toMatch(/no new|no moving/);
    expect(listing).toMatch(/don[\u2019']t|do not/);
  });
  it("side angle hint references lengthwise / narrow end vocabulary", () => {
    const side = PERSPECTIVE_OPTIONS.find((o) => o.value === "change_angle_side");
    expect(side?.hint).toBeDefined();
    const h = (side?.hint ?? "").toLowerCase();
    expect(h).toMatch(/lengthwise|narrow/);
  });
  it("geometry section includes align verticals and level horizon", () => {
    const geometryValues = PERSPECTIVE_OPTIONS.filter((o) => o.section === "geometry").map((o) => o.value);
    expect(geometryValues).toContain("align_verticals_auto");
    expect(geometryValues).toContain("level_horizon_auto");
  });
  it("no duplicate perspective values", () => {
    const withValue = PERSPECTIVE_OPTIONS.map((o) => o.value).filter((v) => v != null);
    expect(new Set(withValue).size).toBe(withValue.length);
  });
});

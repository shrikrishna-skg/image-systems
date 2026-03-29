import { describe, expect, it } from "vitest";
import {
  formatDimensions,
  formatFileSize,
  formatMegapixels,
  formatSignedBytesDelta,
  pctChange,
  resolvedWH
} from "./comparisonFormatters";
describe("Phase 11 \u2014 comparison formatters", () => {
  it("formatDimensions shows em dash when unknown", () => {
    expect(formatDimensions(null, null)).toBe("\u2014");
    expect(formatDimensions(0, 100)).toContain("?");
  });
  it("formatDimensions shows px when both known", () => {
    expect(formatDimensions(1536, 1824)).toBe("1536 \xD7 1824 px");
  });
  it("formatMegapixels tiers decimals", () => {
    expect(formatMegapixels(1e3, 1e3)).toBe("1.00 MP");
    expect(formatMegapixels(4e3, 3e3)).toMatch(/12/);
  });
  it("formatFileSize handles B, KB, MB", () => {
    expect(formatFileSize(null)).toBe("\u2014");
    expect(formatFileSize(500)).toMatch(/B$/);
    expect(formatFileSize(2048)).toContain("KB");
    expect(formatFileSize(3 * 1024 * 1024)).toContain("MB");
  });
  it("pctChange signs and rounding", () => {
    expect(pctChange(100, 150)).toBe("+50%");
    expect(pctChange(100, 50)).toBe("-50%");
    expect(pctChange(100, 100)).toBe("0%");
    expect(pctChange(0, 10)).toBeNull();
  });
  it("formatSignedBytesDelta uses minus sign for shrink", () => {
    const d = formatSignedBytesDelta(2e3, 1e3);
    expect(d).toContain("\u2212");
    expect(formatSignedBytesDelta(1e3, 2e3)).toMatch(/^\+/);
  });
  it("resolvedWH prefers meta over intrinsic", () => {
    expect(
      resolvedWH({ width: 800, height: 600, fileSizeBytes: null }, { w: 1, h: 1 })
    ).toEqual({ w: 800, h: 600 });
    expect(resolvedWH({ width: null, height: null, fileSizeBytes: null }, { w: 10, h: 20 })).toEqual({
      w: 10,
      h: 20
    });
    expect(resolvedWH({ width: null, height: 5, fileSizeBytes: null }, null)).toBeNull();
  });
});

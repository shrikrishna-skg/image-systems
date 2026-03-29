import { describe, expect, it } from "vitest";
import { defaultImageSizeFilter } from "./importUrlImageFilters";
import {
  countSizedScrapeThumbs,
  decodeUrlSearchParam,
  filterVisibleScrapedImages,
  formatThumbSizeLabel,
  isValidHttpUrl,
  pickLargestByThumbArea,
  pruneSelectionToVisibleUrls,
  sortScrapedImagesByPixelSize,
  stringSetsEqual,
  thumbPixelArea,
  toImportPreviewUrl,
  validatedHttpUrlForExternalOpen
} from "./importUrlScanModel";
describe("importUrlScanModel", () => {
  describe("toImportPreviewUrl", () => {
    it("returns null for blank", () => {
      expect(toImportPreviewUrl("")).toBeNull();
      expect(toImportPreviewUrl("  	")).toBeNull();
    });
    it("keeps absolute http(s)", () => {
      expect(toImportPreviewUrl("https://ex.com/a")).toBe("https://ex.com/a");
      expect(toImportPreviewUrl("HTTP://EX.COM")).toBe("HTTP://EX.COM");
    });
    it("prefixes scheme-less hosts", () => {
      expect(toImportPreviewUrl("ex.com/path")).toBe("https://ex.com/path");
    });
  });
  describe("isValidHttpUrl / validatedHttpUrlForExternalOpen", () => {
    it("accepts http(s) only", () => {
      expect(isValidHttpUrl("https://a.b")).toBe(true);
      expect(isValidHttpUrl("http://localhost:3000/x")).toBe(true);
      expect(isValidHttpUrl("ftp://x")).toBe(false);
      expect(isValidHttpUrl("not a url")).toBe(false);
    });
    it("guards external open", () => {
      expect(validatedHttpUrlForExternalOpen(null)).toBeNull();
      expect(validatedHttpUrlForExternalOpen("javascript:alert(1)")).toBeNull();
      expect(validatedHttpUrlForExternalOpen("https://safe.example")).toBe("https://safe.example");
    });
  });
  describe("decodeUrlSearchParam", () => {
    it("decodes percent-encoding", () => {
      expect(decodeUrlSearchParam("https%3A%2F%2Fa.com%2Fx")).toBe("https://a.com/x");
    });
    it("falls back on invalid sequences", () => {
      expect(decodeUrlSearchParam("%")).toBe("%");
    });
  });
  describe("filterVisibleScrapedImages", () => {
    const imgs = [{ url: "a" }, { url: "b" }, { url: "c" }];
    it("drops error thumbs", () => {
      const dims = { a: "error", b: { w: 100, h: 100 } };
      const f = defaultImageSizeFilter();
      expect(filterVisibleScrapedImages(imgs, dims, f, false).map((i) => i.url)).toEqual(["b", "c"]);
    });
    it("with inactive filter, keeps unsized", () => {
      const f = defaultImageSizeFilter();
      expect(filterVisibleScrapedImages(imgs, {}, f, true).map((i) => i.url)).toEqual(["a", "b", "c"]);
    });
    it("with active min pixels, hides unsized when hideUnsizedWhenFiltering", () => {
      const f = { ...defaultImageSizeFilter(), minPixels: 600 * 400 };
      const dims = { a: { w: 600, h: 400 } };
      expect(filterVisibleScrapedImages(imgs, dims, f, true).map((i) => i.url)).toEqual(["a"]);
    });
    it("max pixels drops large images", () => {
      const f = { ...defaultImageSizeFilter(), maxPixels: 2e4 };
      const dims = { a: { w: 200, h: 200 }, b: { w: 100, h: 100 } };
      expect(filterVisibleScrapedImages(imgs, dims, f, false).map((i) => i.url)).toEqual(["b", "c"]);
    });
  });
  describe("sortScrapedImagesByPixelSize", () => {
    const imgs = [{ url: "a" }, { url: "b" }, { url: "c" }];
    const dims = { a: { w: 100, h: 100 }, b: { w: 200, h: 200 }, c: { w: 50, h: 50 } };
    it("preserves order for none", () => {
      expect(sortScrapedImagesByPixelSize(imgs, dims, "none").map((i) => i.url)).toEqual(["a", "b", "c"]);
    });
    it("sorts largest first", () => {
      expect(sortScrapedImagesByPixelSize(imgs, dims, "desc").map((i) => i.url)).toEqual(["b", "a", "c"]);
    });
    it("sorts smallest first", () => {
      expect(sortScrapedImagesByPixelSize(imgs, dims, "asc").map((i) => i.url)).toEqual(["c", "a", "b"]);
    });
  });
  describe("formatThumbSizeLabel", () => {
    it("formats megapixels and small counts", () => {
      expect(formatThumbSizeLabel(void 0)).toBe("\u2026");
      expect(formatThumbSizeLabel("error")).toBe("Failed");
      expect(formatThumbSizeLabel({ w: 2e3, h: 1e3 })).toMatch(/2(\.0)? MP/);
      expect(formatThumbSizeLabel({ w: 100, h: 100 })).toBe("10k px");
    });
  });
  describe("countSizedScrapeThumbs / thumbPixelArea / pickLargestByThumbArea", () => {
    const imgs = [{ url: "x" }, { url: "y" }, { url: "z" }];
    const dims = {
      x: { w: 10, h: 10 },
      y: "error",
      z: { w: 5, h: 5 }
    };
    it("counts non-error known dimensions", () => {
      expect(countSizedScrapeThumbs(imgs, dims)).toBe(2);
    });
    it("pixel area", () => {
      expect(thumbPixelArea("x", dims)).toBe(100);
      expect(thumbPixelArea("y", dims)).toBe(0);
      expect(thumbPixelArea("missing", dims)).toBe(0);
    });
    it("picks largest up to room", () => {
      expect(pickLargestByThumbArea(imgs, dims, 0)).toEqual([]);
      expect(pickLargestByThumbArea(imgs, dims, 1).map((i) => i.url)).toEqual(["x"]);
      expect(pickLargestByThumbArea(imgs, dims, 2).map((i) => i.url)).toEqual(["x", "z"]);
      expect(pickLargestByThumbArea(imgs, dims, 10).map((i) => i.url)).toEqual(["x", "z", "y"]);
    });
  });
  describe("pruneSelectionToVisibleUrls / stringSetsEqual", () => {
    it("prunes to intersection order-stable for iteration", () => {
      const next = pruneSelectionToVisibleUrls(/* @__PURE__ */ new Set(["a", "b", "c"]), /* @__PURE__ */ new Set(["b", "d"]));
      expect([...next]).toEqual(["b"]);
    });
    it("stringSetsEqual", () => {
      expect(stringSetsEqual(/* @__PURE__ */ new Set(["a"]), /* @__PURE__ */ new Set(["a"]))).toBe(true);
      expect(stringSetsEqual(/* @__PURE__ */ new Set(["a"]), /* @__PURE__ */ new Set(["b"]))).toBe(false);
      expect(stringSetsEqual(/* @__PURE__ */ new Set(["a", "b"]), /* @__PURE__ */ new Set(["b", "a"]))).toBe(true);
    });
  });
});

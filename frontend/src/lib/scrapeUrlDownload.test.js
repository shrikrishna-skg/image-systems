import { describe, expect, it } from "vitest";
import { suggestedFilenameForScrapeUrl } from "./scrapeUrlDownload";
describe("suggestedFilenameForScrapeUrl", () => {
  it("uses last path segment and extension", () => {
    expect(suggestedFilenameForScrapeUrl("https://cdn.example.com/a/b/photo.JPEG?v=1", 1)).toMatch(/photo\.jpeg$/i);
  });
  it("falls back for odd URLs", () => {
    expect(suggestedFilenameForScrapeUrl("not-a-url", 3)).toBe("import-0003.jpg");
  });
});

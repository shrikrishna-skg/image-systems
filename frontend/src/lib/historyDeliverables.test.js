import { describe, expect, it } from "vitest";
import {
  applyHistoryLibraryFilters,
  filterImageLibraryByDate,
  filterImageLibraryByQuery,
  HISTORY_LIBRARY_LIST_LIMIT,
  HISTORY_LIBRARY_LIST_OFFSET,
  HISTORY_SEEN_ARCHIVE_KEY,
  historyLocalDownloadFilename,
  latestImageVersion,
  sortImageLibrary,
  sumVersionProcessingCostUsd
} from "./historyDeliverables";
function img(partial) {
  return {
    width: null,
    height: null,
    file_size_bytes: null,
    mime_type: null,
    created_at: "",
    versions: [],
    ...partial
  };
}
function v(partial) {
  return {
    version_type: "enhance",
    width: null,
    height: null,
    file_size_bytes: null,
    provider: null,
    model: null,
    scale_factor: null,
    processing_cost_usd: null,
    created_at: "",
    ...partial
  };
}
describe("historyDeliverables", () => {
  it("exports stable archive key and list window", () => {
    expect(HISTORY_SEEN_ARCHIVE_KEY).toBe("imagesystems.seenArchive");
    expect(HISTORY_LIBRARY_LIST_OFFSET).toBe(0);
    expect(HISTORY_LIBRARY_LIST_LIMIT).toBe(50);
  });
  it("latestImageVersion returns last entry or undefined", () => {
    expect(latestImageVersion(void 0)).toBeUndefined();
    expect(latestImageVersion([])).toBeUndefined();
    const a = v({ id: "a" });
    const b = v({ id: "b" });
    expect(latestImageVersion([a])).toBe(a);
    expect(latestImageVersion([a, b])).toBe(b);
  });
  it("sumVersionProcessingCostUsd coalesces null and sums", () => {
    expect(sumVersionProcessingCostUsd(void 0)).toBe(0);
    expect(sumVersionProcessingCostUsd([])).toBe(0);
    expect(
      sumVersionProcessingCostUsd([
        v({ id: "1", processing_cost_usd: 0.01 }),
        v({ id: "2", processing_cost_usd: null }),
        v({ id: "3", processing_cost_usd: 0.02 })
      ])
    ).toBeCloseTo(0.03, 6);
  });
  it("filterImageLibraryByQuery trims, is case-insensitive, matches substring", () => {
    const rows = [
      img({ id: "1", original_filename: "LivingRoom_HDR.jpg" }),
      img({ id: "2", original_filename: "bath_final.png" })
    ];
    expect(filterImageLibraryByQuery(rows, "")).toEqual(rows);
    expect(filterImageLibraryByQuery(rows, "   ")).toEqual(rows);
    expect(filterImageLibraryByQuery(rows, "living")).toEqual([rows[0]]);
    expect(filterImageLibraryByQuery(rows, "LIVINGROOM")).toEqual([rows[0]]);
    expect(filterImageLibraryByQuery(rows, "final")).toEqual([rows[1]]);
    expect(filterImageLibraryByQuery(rows, "nope")).toEqual([]);
  });
  it("historyLocalDownloadFilename matches enhanced vs original", () => {
    expect(historyLocalDownloadFilename(null)).toBe("original");
    expect(historyLocalDownloadFilename(void 0)).toBe("original");
    expect(historyLocalDownloadFilename("")).toBe("original");
    expect(historyLocalDownloadFilename("ver-1")).toBe("enhanced.png");
  });
  it("filterImageLibraryByDate keeps today only in local window", () => {
    const ref = new Date(2026, 2, 15, 14, 30, 0);
    const rows = [
      img({ id: "a", original_filename: "old.png", created_at: "2026-03-14T23:59:00" }),
      img({ id: "b", original_filename: "today.png", created_at: "2026-03-15T08:00:00" })
    ];
    const out = filterImageLibraryByDate(rows, "today", ref);
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });
  it("filterImageLibraryByDate last_7_days is inclusive rolling window", () => {
    const ref = new Date(2026, 2, 15, 12, 0, 0);
    const rows = [
      img({ id: "too_old", original_filename: "x.png", created_at: "2026-03-08T12:00:00" }),
      img({ id: "edge", original_filename: "y.png", created_at: "2026-03-09T00:00:00" }),
      img({ id: "new", original_filename: "z.png", created_at: "2026-03-15T18:00:00" })
    ];
    const out = filterImageLibraryByDate(rows, "last_7_days", ref);
    expect(out.map((r) => r.id)).toEqual(["edge", "new"]);
  });
  it("sortImageLibrary orders by created_at and filename", () => {
    const rows = [
      img({ id: "1", original_filename: "b.png", created_at: "2026-01-02T00:00:00.000Z" }),
      img({ id: "2", original_filename: "a.png", created_at: "2026-01-01T00:00:00.000Z" })
    ];
    expect(sortImageLibrary(rows, "newest").map((r) => r.id)).toEqual(["1", "2"]);
    expect(sortImageLibrary(rows, "oldest").map((r) => r.id)).toEqual(["2", "1"]);
    expect(sortImageLibrary(rows, "name_asc").map((r) => r.id)).toEqual(["2", "1"]);
    expect(sortImageLibrary(rows, "name_desc").map((r) => r.id)).toEqual(["1", "2"]);
  });
  it("applyHistoryLibraryFilters chains query, date, sort", () => {
    const ref = new Date(2026, 2, 15, 12, 0, 0);
    const rows = [
      img({ id: "a", original_filename: "Lobby_a.png", created_at: "2026-03-15T08:00:00" }),
      img({ id: "b", original_filename: "lobby_b.png", created_at: "2026-03-10T08:00:00" }),
      img({ id: "c", original_filename: "other.png", created_at: "2026-03-15T08:00:00" })
    ];
    const out = applyHistoryLibraryFilters(rows, "lobby", "last_7_days", "name_asc", ref);
    expect(out.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

const HISTORY_SEEN_ARCHIVE_KEY = "imagesystems.seenArchive";
const HISTORY_LIBRARY_LIST_OFFSET = 0;
const HISTORY_LIBRARY_LIST_LIMIT = 50;
function latestImageVersion(versions) {
  if (!versions?.length) return void 0;
  return versions[versions.length - 1];
}
function sumVersionProcessingCostUsd(versions) {
  if (!versions?.length) return 0;
  return versions.reduce((sum, v) => sum + (v.processing_cost_usd ?? 0), 0);
}
function filterImageLibraryByQuery(images, query) {
  const q = query.trim().toLowerCase();
  if (!q) return images;
  return images.filter((img) => (img.original_filename ?? "").toLowerCase().includes(q));
}
function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function filterImageLibraryByDate(images, preset, referenceNow = /* @__PURE__ */ new Date()) {
  if (preset === "all") return images;
  const now = referenceNow;
  let start;
  if (preset === "today") {
    start = startOfLocalDay(now);
  } else if (preset === "last_7_days") {
    start = startOfLocalDay(now);
    start.setDate(start.getDate() - 6);
  } else {
    start = startOfLocalDay(now);
    start.setDate(start.getDate() - 29);
  }
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return images.filter((img) => {
    const t = new Date(img.created_at).getTime();
    if (Number.isNaN(t)) return false;
    return t >= start.getTime() && t <= end.getTime();
  });
}
function sortImageLibrary(images, order) {
  const copy = [...images];
  copy.sort((a, b) => {
    if (order === "newest" || order === "oldest") {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      const da = Number.isNaN(ta) ? 0 : ta;
      const db = Number.isNaN(tb) ? 0 : tb;
      return order === "newest" ? db - da : da - db;
    }
    const na = (a.original_filename ?? "").toLowerCase();
    const nb = (b.original_filename ?? "").toLowerCase();
    const c = na.localeCompare(nb, void 0, { sensitivity: "base" });
    return order === "name_asc" ? c : -c;
  });
  return copy;
}
function applyHistoryLibraryFilters(images, query, datePreset, sortOrder, referenceNow) {
  let list = filterImageLibraryByQuery(images, query);
  list = filterImageLibraryByDate(list, datePreset, referenceNow);
  return sortImageLibrary(list, sortOrder);
}
function historyLocalDownloadFilename(versionId) {
  return versionId ? "enhanced.png" : "original";
}
export {
  HISTORY_LIBRARY_LIST_LIMIT,
  HISTORY_LIBRARY_LIST_OFFSET,
  HISTORY_SEEN_ARCHIVE_KEY,
  applyHistoryLibraryFilters,
  filterImageLibraryByDate,
  filterImageLibraryByQuery,
  historyLocalDownloadFilename,
  latestImageVersion,
  sortImageLibrary,
  sumVersionProcessingCostUsd
};

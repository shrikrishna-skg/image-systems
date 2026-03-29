const STORAGE_KEY = "iep:importUrlHistory:v1";
const MAX_ENTRIES = 80;
function safeParse(raw) {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (row) => row && typeof row === "object" && typeof row.inputUrl === "string" && typeof row.finalUrl === "string" && typeof row.scannedAt === "string"
    ).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}
function loadImportUrlHistory() {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}
function persist(entries) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
  }
}
function recordImportUrlScan(entry) {
  const scannedAt = entry.scannedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const input = entry.inputUrl.trim();
  const finalUrl = entry.finalUrl.trim() || input;
  if (!input) return;
  const prev = loadImportUrlHistory().filter((e) => e.inputUrl.trim() !== input);
  const next = {
    inputUrl: input,
    finalUrl,
    scannedAt,
    imageCount: entry.imageCount,
    truncated: entry.truncated
  };
  persist([next, ...prev].slice(0, MAX_ENTRIES));
}
function removeImportUrlHistoryEntry(inputUrl) {
  const t = inputUrl.trim();
  persist(loadImportUrlHistory().filter((e) => e.inputUrl.trim() !== t));
}
function clearImportUrlHistory() {
  persist([]);
}
export {
  clearImportUrlHistory,
  loadImportUrlHistory,
  recordImportUrlScan,
  removeImportUrlHistoryEntry
};

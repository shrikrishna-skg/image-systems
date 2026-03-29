import {
  imagePassesSizeFilter,
  isSizeFilterActive
} from "./importUrlImageFilters";
function toImportPreviewUrl(raw) {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}
function isValidHttpUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
function decodeUrlSearchParam(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
function validatedHttpUrlForExternalOpen(u) {
  if (!u || !isValidHttpUrl(u)) return null;
  return u;
}
function filterVisibleScrapedImages(images, dimensionsByUrl, sizeFilter, hideUnsizedWhenFiltering) {
  const sizeFilterActive = isSizeFilterActive(sizeFilter);
  return images.filter((img) => {
    const meta = dimensionsByUrl[img.url];
    if (meta === "error") return false;
    if (meta === void 0) {
      if (!sizeFilterActive) return true;
      return !hideUnsizedWhenFiltering;
    }
    return imagePassesSizeFilter(meta.w, meta.h, sizeFilter);
  });
}
function sortScrapedImagesByPixelSize(images, dimensionsByUrl, order) {
  if (order === "none") return [...images];
  const indexed = images.map((img, index) => ({ img, index }));
  const area = (url) => thumbPixelArea(url, dimensionsByUrl);
  indexed.sort((a, b) => {
    const pa = area(a.img.url);
    const pb = area(b.img.url);
    const unkA = pa <= 0;
    const unkB = pb <= 0;
    if (unkA && unkB) return a.index - b.index;
    if (unkA) return 1;
    if (unkB) return -1;
    if (order === "desc") {
      if (pb !== pa) return pb - pa;
    } else {
      if (pa !== pb) return pa - pb;
    }
    return a.index - b.index;
  });
  return indexed.map((x) => x.img);
}
function formatThumbSizeLabel(meta) {
  if (meta === "error") return "Failed";
  if (!meta) return "\u2026";
  const px = meta.w * meta.h;
  if (px <= 0) return "\u2026";
  if (px >= 1e6) {
    const mp = px / 1e6;
    return mp >= 10 ? `${Math.round(mp)} MP` : `${mp.toFixed(mp >= 1 ? 1 : 2)} MP`;
  }
  if (px >= 1e4) return `${Math.round(px / 1e3)}k px`;
  return `${px.toLocaleString()} px`;
}
function countSizedScrapeThumbs(images, dimensionsByUrl) {
  return images.filter((i) => {
    const m = dimensionsByUrl[i.url];
    return m !== void 0 && m !== "error";
  }).length;
}
function thumbPixelArea(imageUrl, dimensionsByUrl) {
  const m = dimensionsByUrl[imageUrl];
  if (!m || m === "error") return 0;
  return m.w * m.h;
}
function pickLargestByThumbArea(visible, dimensionsByUrl, room) {
  if (room <= 0) return [];
  const ranked = [...visible].sort(
    (a, b) => thumbPixelArea(b.url, dimensionsByUrl) - thumbPixelArea(a.url, dimensionsByUrl)
  );
  return ranked.slice(0, room);
}
function pruneSelectionToVisibleUrls(prev, visibleUrls) {
  const next = /* @__PURE__ */ new Set();
  for (const u of prev) {
    if (visibleUrls.has(u)) next.add(u);
  }
  return next;
}
function stringSetsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const u of a) if (!b.has(u)) return false;
  return true;
}
export {
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
};

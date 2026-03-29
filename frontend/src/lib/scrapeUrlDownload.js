import JSZip from "jszip";
import { clampDimensionsToMaxPixels } from "./canvasSafe";
import {
  defaultBulkZipArchiveStem,
  makeUniqueZipEntryName,
  sanitizeExportBasename,
  sanitizeZipArchiveBasename
} from "./downloadExport";
function triggerBrowserDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
function suggestedFilenameForScrapeUrl(url, index1) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() || "";
    const clean = seg.split("?")[0];
    const extM = clean.match(/\.([a-z0-9]{2,5})$/i);
    const ext = (extM?.[1] || "jpg").toLowerCase();
    const stem = sanitizeExportBasename(clean.replace(/\.[a-z0-9]+$/i, "") || `image-${index1}`);
    return `${stem}.${ext}`;
  } catch {
    return `import-${String(index1).padStart(4, "0")}.jpg`;
  }
}
async function blobFromFetch(url) {
  const res = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    referrerPolicy: "no-referrer"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (!blob.size) throw new Error("empty");
  return blob;
}
async function blobFromCanvas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      try {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w <= 0 || h <= 0) {
          reject(new Error("bad dimensions"));
          return;
        }
        const capped = clampDimensionsToMaxPixels(w, h);
        const canvas = document.createElement("canvas");
        canvas.width = capped.w;
        canvas.height = capped.h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, capped.w, capped.h);
        canvas.toBlob(
          (b) => b && b.size > 0 ? resolve(b) : reject(new Error("toBlob")),
          "image/png"
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("img load"));
    img.src = url;
  });
}
async function fetchImageBlobFromUrl(url) {
  try {
    return await blobFromFetch(url);
  } catch {
    return blobFromCanvas(url);
  }
}
function defaultZipStemForScrapePage(pageUrl) {
  const raw = pageUrl?.trim();
  if (!raw) return defaultBulkZipArchiveStem();
  try {
    const host = new URL(raw).hostname.replace(/^www\./i, "");
    const h = sanitizeExportBasename(host);
    const d = /* @__PURE__ */ new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return sanitizeZipArchiveBasename(`${h || "url-import"}-${y}${m}${day}`);
  } catch {
    return defaultBulkZipArchiveStem();
  }
}
async function downloadScannedImageUrls(urls, options) {
  if (urls.length === 0) throw new Error("No URLs to download.");
  const entries = [];
  let failed = 0;
  for (let i = 0; i < urls.length; i++) {
    if (options?.signal?.aborted) throw new Error("Download cancelled.");
    const u = urls[i];
    try {
      const blob = await fetchImageBlobFromUrl(u);
      entries.push({ filename: suggestedFilenameForScrapeUrl(u, i + 1), blob });
    } catch {
      failed += 1;
    }
  }
  if (entries.length === 0) {
    throw new Error(
      "Could not download any of the selected images. The site may block cross-origin access \u2014 try opening one image in a new tab or import first and export from Operations."
    );
  }
  const used = /* @__PURE__ */ new Set();
  if (entries.length === 1) {
    const name = makeUniqueZipEntryName(used, entries[0].filename);
    triggerBrowserDownload(entries[0].blob, name);
    return { saved: 1, failed, usedZip: false };
  }
  const zip = new JSZip();
  for (const e of entries) {
    const name = makeUniqueZipEntryName(used, e.filename);
    zip.file(name, e.blob);
  }
  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const base = sanitizeZipArchiveBasename(options?.zipArchiveStem?.trim() || defaultBulkZipArchiveStem());
  triggerBrowserDownload(zipBlob, `${base}.zip`);
  return { saved: entries.length, failed, usedZip: true };
}
export {
  defaultZipStemForScrapePage,
  downloadScannedImageUrls,
  suggestedFilenameForScrapeUrl
};

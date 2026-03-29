import { clampDimensionsToMaxPixels, MAX_CANVAS_PIXELS } from "./canvasSafe";
const EDGE_PX = {
  full: null,
  3840: 3840,
  2560: 2560,
  1920: 1920,
  1080: 1080
};
const DOWNLOAD_FORMAT_OPTIONS = [
  {
    id: "as_stored",
    label: "As stored (exact file)",
    hint: "No re-compression. Largest size. Only at full resolution."
  },
  {
    id: "png_lossless",
    label: "PNG \u2014 lossless (default)",
    hint: "Maximum fidelity at chosen size; default for new exports."
  },
  {
    id: "webp_near_lossless",
    label: "WebP \u2014 near-lossless",
    hint: "Excellent detail, often much smaller than PNG."
  },
  { id: "webp_balanced", label: "WebP \u2014 balanced", hint: "Smaller files; still strong for web and MLS." },
  { id: "jpeg_high", label: "JPEG \u2014 high quality", hint: "Great for photos; smaller than PNG." },
  { id: "jpeg_balanced", label: "JPEG \u2014 smaller", hint: "Lower MB; fine for previews and tight uploads." }
];
const DOWNLOAD_SIZE_OPTIONS = [
  { id: "full", label: "Full resolution", hint: "Native pixels from pipeline." },
  { id: "3840", label: "Long edge \u2264 3840 (4K class)", hint: "Heavy print / hero use." },
  { id: "2560", label: "Long edge \u2264 2560 (2K class)", hint: "Balanced large web / brochure." },
  { id: "1920", label: "Long edge \u2264 1920 (1080p class)", hint: "Web galleries, many OTAs." },
  { id: "1080", label: "Long edge \u2264 1080", hint: "Thumbnails, fast uploads, email." }
];
function targetDimensions(w, h, maxLongEdge) {
  if (!maxLongEdge || w <= 0 || h <= 0) return { w, h };
  const m = Math.max(w, h);
  if (m <= maxLongEdge) return { w, h };
  const s = maxLongEdge / m;
  return {
    w: Math.max(1, Math.round(w * s)),
    h: Math.max(1, Math.round(h * s))
  };
}
function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
          return;
        }
        if (type !== "image/png") {
          canvas.toBlob(
            (b2) => b2 ? resolve(b2) : reject(new Error("Export failed \u2014 try PNG or a smaller size.")),
            "image/png"
          );
          return;
        }
        reject(new Error("Export failed \u2014 image may be too large for the browser."));
      },
      type,
      quality
    );
  });
}
async function exportDownloadBlob(input, format, maxEdge) {
  const maxLong = EDGE_PX[maxEdge];
  if (format === "as_stored" && maxLong == null) {
    const mime = input.type && input.type !== "application/octet-stream" ? input.type : "image/png";
    const extension = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : mime.includes("png") ? "png" : "png";
    return { blob: input, extension, mime };
  }
  const effectiveFormat = format === "as_stored" ? "png_lossless" : format;
  const bmp = await createImageBitmap(input);
  try {
    const td = targetDimensions(bmp.width, bmp.height, maxLong);
    const { w: cw, h: ch } = clampDimensionsToMaxPixels(td.w, td.h, MAX_CANVAS_PIXELS);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, cw, ch);
    switch (effectiveFormat) {
      case "png_lossless": {
        const blob = await canvasToBlob(canvas, "image/png");
        return { blob, extension: "png", mime: "image/png" };
      }
      case "webp_near_lossless": {
        const blob = await canvasToBlob(canvas, "image/webp", 0.92);
        return { blob, extension: "webp", mime: "image/webp" };
      }
      case "webp_balanced": {
        const blob = await canvasToBlob(canvas, "image/webp", 0.85);
        return { blob, extension: "webp", mime: "image/webp" };
      }
      case "jpeg_high": {
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.93);
        return { blob, extension: "jpg", mime: "image/jpeg" };
      }
      case "jpeg_balanced": {
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.88);
        return { blob, extension: "jpg", mime: "image/jpeg" };
      }
      default: {
        const blob = await canvasToBlob(canvas, "image/png");
        return { blob, extension: "png", mime: "image/png" };
      }
    }
  } finally {
    bmp.close();
  }
}
function downloadFilenameStem(kind, versionType, width, height) {
  if (kind === "original") return "original";
  const dim = width && height ? `${width}x${height}` : "export";
  return `${versionType || "version"}_${dim}`;
}
function sanitizeExportBasename(raw) {
  const trimmed = raw.trim().replace(/[/\\]+/g, "-");
  let s = trimmed;
  const dot = s.lastIndexOf(".");
  if (dot > 0 && dot < s.length - 1) s = s.slice(0, dot);
  s = s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-_.]+|[-_.]+$/g, "");
  return (s || "export").slice(0, 120);
}
function stemFromOriginalFilename(filename) {
  return sanitizeExportBasename(filename);
}
const EXPORT_NAMING_PRESET_OPTIONS = [
  {
    id: "pipeline",
    label: "Pipeline default",
    hint: "e.g. enhanced_1920x1080 \u2014 type and pixel dimensions."
  },
  {
    id: "original",
    label: "From upload name",
    hint: "Uses your original filename as a base, with a row suffix."
  },
  {
    id: "dated",
    label: "Upload name + date",
    hint: "Adds today\u2019s date (YYYY-MM-DD) to the upload stem."
  },
  { id: "dims", label: "Dimensions + type only", hint: "Short stem from size and version type." },
  {
    id: "custom",
    label: "Custom base",
    hint: "Your text below, plus a per-row suffix so files stay unique."
  }
];
function exportRowSuffix(kind, versionType, width, height) {
  if (kind === "original") return "original";
  const dim = width && height ? `${width}x${height}` : "export";
  return `${versionType || "version"}_${dim}`;
}
function buildExportStem(args) {
  const { preset, customBase, aiBase, originalFilename, kind, versionType, width, height } = args;
  const row = exportRowSuffix(kind, versionType, width, height);
  if (aiBase) {
    const base = sanitizeExportBasename(aiBase);
    return `${base}-${row}`;
  }
  if (preset === "pipeline") {
    return downloadFilenameStem(kind, versionType, width, height);
  }
  if (preset === "dims") {
    return row;
  }
  const uploadStem = stemFromOriginalFilename(originalFilename);
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (preset === "original") {
    return `${uploadStem}-${row}`;
  }
  if (preset === "dated") {
    return `${uploadStem}-${today}-${row}`;
  }
  if (preset === "custom") {
    const c = sanitizeExportBasename(customBase);
    if (!c || c === "export") return downloadFilenameStem(kind, versionType, width, height);
    return `${c}-${row}`;
  }
  return downloadFilenameStem(kind, versionType, width, height);
}
function buildBulkSeriesStem(seriesPrefix, index1Based, pad = 3) {
  const p = sanitizeExportBasename(seriesPrefix || "export");
  return `${p}-${String(index1Based).padStart(pad, "0")}`;
}
function appendSizeToFilename(stem, maxEdge, ext) {
  if (maxEdge === "full") return `${stem}.${ext}`;
  return `${stem}_max${maxEdge}.${ext}`;
}
function sanitizeZipArchiveBasename(raw) {
  const s = sanitizeExportBasename(raw.replace(/\.zip$/i, ""));
  return s || "bulk-export";
}
function makeUniqueZipEntryName(used, filename) {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  let n = 2;
  let candidate = `${base}-${n}${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}-${n}${ext}`;
  }
  used.add(candidate);
  return candidate;
}
function defaultBulkZipArchiveStem() {
  const d = /* @__PURE__ */ new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `bulk-export-${y}${m}${day}`;
}
export {
  DOWNLOAD_FORMAT_OPTIONS,
  DOWNLOAD_SIZE_OPTIONS,
  EXPORT_NAMING_PRESET_OPTIONS,
  appendSizeToFilename,
  buildBulkSeriesStem,
  buildExportStem,
  defaultBulkZipArchiveStem,
  downloadFilenameStem,
  exportDownloadBlob,
  exportRowSuffix,
  makeUniqueZipEntryName,
  sanitizeExportBasename,
  sanitizeZipArchiveBasename,
  stemFromOriginalFilename
};

import { clampDimensionsToMaxPixels, MAX_CANVAS_PIXELS, upscaleDimensionsWithinCap } from "./canvasSafe";
import {
  listingAngleUsesHorizontalRecenter,
  listingHeroCentroidProfile,
  listingRecenterMaxShiftRatio,
  LISTING_RECENTER_PASSES,
  perspectiveUsesRotatedQuad,
  usesChangeAngleSobel
} from "./localEnhancePolicy";
import { estimateAutoRotationRad, estimateAutoRotationRadCenterAngle } from "./perspectiveAuto";
function defaultLocalTuning() {
  return {
    lighting: "bright",
    qualityPreset: "full_enhance",
    perspective: null,
    roomType: "general"
  };
}
function lightingFilters(lighting) {
  switch (lighting) {
    case "bright":
      return ["brightness(1.1)", "contrast(1.1)", "saturate(1.04)"];
    case "warm":
      return ["sepia(0.12)", "saturate(1.07)", "brightness(1.03)", "contrast(1.05)"];
    case "natural":
      return ["brightness(1.03)", "contrast(1.11)", "saturate(1.04)"];
    case "hdr":
      return ["brightness(1.05)", "contrast(1.18)", "saturate(1.1)"];
    case "evening":
      return ["brightness(0.92)", "contrast(1.1)", "sepia(0.14)"];
    default:
      return ["brightness(1.04)", "contrast(1.11)", "saturate(1.06)"];
  }
}
function qualityFilters(preset) {
  switch (preset) {
    case "sharpen":
      return ["contrast(1.08)"];
    case "denoise":
      return ["brightness(1.03)", "contrast(0.99)"];
    case "color_correct":
      return ["saturate(1.08)", "hue-rotate(-2deg)", "contrast(1.05)"];
    case "full_enhance":
    default:
      return ["contrast(1.04)"];
  }
}
function roomFilters(roomType) {
  switch (roomType) {
    case "exterior":
      return ["saturate(1.06)"];
    case "pool":
      return ["saturate(1.08)", "brightness(1.02)"];
    case "bathroom":
      return ["brightness(1.04)"];
    case "lobby":
      return ["brightness(1.03)", "contrast(1.03)"];
    default:
      return [];
  }
}
function buildColorFilter(tuning) {
  const parts = [
    ...lightingFilters(tuning.lighting),
    ...qualityFilters(tuning.qualityPreset),
    ...roomFilters(tuning.roomType)
  ];
  return parts.join(" ");
}
function estimateHorizontalContentCentroid(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width < 16 || canvas.height < 16) return null;
  const w = canvas.width;
  const h = canvas.height;
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
  const d = data.data;
  const y0 = Math.floor(h * 0.18);
  let sum = 0;
  let total = 0;
  for (let y = y0; y < h; y++) {
    const rowBias = 0.65 + y / h * 0.72;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma > 249 && r > 246 && g > 246 && b > 246) continue;
      let ed = 0;
      if (x > 0) {
        const j = i - 4;
        const l2 = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
        ed = Math.abs(luma - l2);
      }
      const wt = (1 + Math.min(ed, 80) * 0.014) * rowBias;
      sum += x * wt;
      total += wt;
    }
  }
  if (total < w * 1.2) return null;
  return sum / total;
}
function lumaAt(d, w, x, y) {
  const i = (y * w + x) * 4;
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}
function estimateListingHeroCentroidX(canvas, profile) {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width < 16 || canvas.height < 16) return null;
  const w = canvas.width;
  const h = canvas.height;
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
  const d = data.data;
  const yStart = Math.floor(h * 0.26);
  const yEnd = Math.floor(h * 0.78);
  const midY = h * 0.52;
  const sigma = Math.max(h * 0.2, 48);
  const xMid = w * 0.5;
  const yLowerStart = Math.floor(h * profile.lowerRowStartYRatio);
  const domYEnd = profile.dominanceYEndRatio >= 1 ? yEnd : Math.min(yEnd, Math.floor(h * profile.dominanceYEndRatio));
  let leftW = 0;
  let rightW = 0;
  for (let y = yStart; y < domYEnd; y++) {
    const yn = (y - midY) / sigma;
    const furnitureBand = Math.exp(-yn * yn);
    const rowBias = 0.38 + 1.15 * furnitureBand;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma > 249 && r > 246 && g > 246 && b > 246) continue;
      let ed = 0;
      if (x > 0) {
        const j = i - 4;
        const l2 = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
        ed = Math.abs(luma - l2);
      }
      const baseWt = (1 + Math.min(ed, 90) * 0.016) * rowBias;
      if (x < xMid) leftW += baseWt;
      else rightW += baseWt;
    }
  }
  let xMin = 0;
  let xMax = w;
  const ratioR = rightW / Math.max(leftW, 1e-6);
  const ratioL = leftW / Math.max(rightW, 1e-6);
  if (ratioR > 1.16) {
    xMin = Math.floor(w * 0.18);
    xMax = w;
  } else if (ratioL > 1.16) {
    xMin = 0;
    xMax = Math.ceil(w * 0.82);
  }
  let sum = 0;
  let total = 0;
  for (let y = yStart; y < yEnd; y++) {
    const yn = (y - midY) / sigma;
    const furnitureBand = Math.exp(-yn * yn);
    let rowBias = 0.38 + 1.15 * furnitureBand;
    if (y >= yLowerStart && profile.lowerRowScale < 1) {
      rowBias *= profile.lowerRowScale;
    }
    for (let x = xMin; x < xMax; x++) {
      const i = (y * w + x) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma > 249 && r > 246 && g > 246 && b > 246) continue;
      let ed = 0;
      if (x > 0) {
        const j = i - 4;
        const l2 = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
        ed = Math.abs(luma - l2);
      }
      let vg = 0;
      if (y > 0 && y < h - 1) {
        vg = Math.abs(lumaAt(d, w, x, y + 1) - lumaAt(d, w, x, y - 1));
      }
      const baseWt = (1 + Math.min(ed, 90) * 0.016) * rowBias;
      const wt = baseWt * (1 + Math.min(vg, 160) * 42e-4);
      sum += x * wt;
      total += wt;
    }
  }
  if (total < w * 0.75) {
    return estimateHorizontalContentCentroid(canvas);
  }
  return sum / total;
}
function shiftCanvasHorizontally(src, shift) {
  const w = src.width;
  const h = src.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const o = out.getContext("2d");
  if (!o) return src;
  o.fillStyle = "#ffffff";
  o.fillRect(0, 0, w, h);
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = "high";
  o.drawImage(src, shift, 0);
  return out;
}
function listingHeroTargetXRatio() {
  return 0.5;
}
function horizontallyRecenterListingCanvas(src, perspective) {
  const profile = listingHeroCentroidProfile(perspective);
  const targetX = listingHeroTargetXRatio();
  let cur = src;
  for (let pass = 0; pass < LISTING_RECENTER_PASSES; pass++) {
    const w = cur.width;
    const maxS = Math.floor(w * listingRecenterMaxShiftRatio(perspective));
    const c = estimateListingHeroCentroidX(cur, profile);
    if (c == null) break;
    let shift = Math.round(targetX * w - c);
    shift = Math.max(-maxS, Math.min(maxS, shift));
    if (Math.abs(shift) < 4) break;
    cur = shiftCanvasHorizontally(cur, shift);
  }
  return cur;
}
function getPerspectiveImageMatrix(cw, ch, perspective, autoRotationRad) {
  if (perspective === "align_verticals_auto" || perspective === "level_horizon_auto" || usesChangeAngleSobel(perspective)) {
    const m = new DOMMatrix();
    m.translateSelf(cw / 2, ch / 2);
    m.scaleSelf(0.88, 0.88);
    m.rotateSelf(autoRotationRad * 180 / Math.PI);
    return m;
  }
  if (perspective === "straighten") {
    const m = new DOMMatrix();
    m.translateSelf(cw / 2, ch / 2);
    m.scaleSelf(0.86, 0.86);
    m.rotateSelf(-1.1);
    m.multiplySelf(new DOMMatrix([1, 0.024, -0.03, 1, 0, 0]));
    return m;
  }
  return null;
}
function tightCropBoundsForPerspectiveQuad(m, iw, ih, cw, ch) {
  const corners = [
    [-iw / 2, -ih / 2],
    [iw / 2, -ih / 2],
    [iw / 2, ih / 2],
    [-iw / 2, ih / 2]
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lx, ly] of corners) {
    const p = new DOMPoint(lx, ly).matrixTransform(m);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const x = Math.max(0, Math.floor(minX));
  const y = Math.max(0, Math.floor(minY));
  const x2 = Math.min(cw, Math.ceil(maxX));
  const y2 = Math.min(ch, Math.ceil(maxY));
  return {
    x,
    y,
    w: Math.max(1, x2 - x),
    h: Math.max(1, y2 - y)
  };
}
function drawWithPerspectiveGeometry(ctx, bmp, cw, ch, perspective, autoRotationRad) {
  const iw = bmp.width;
  const ih = bmp.height;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const m = getPerspectiveImageMatrix(cw, ch, perspective, autoRotationRad);
  if (m) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(bmp, -iw / 2, -ih / 2, iw, ih);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else if (perspective === "correct_distortion") {
    const f = 0.024;
    const sx = f * iw;
    const sy = f * ih;
    const sw = Math.max(1, iw - 2 * sx);
    const sh = Math.max(1, ih - 2 * sy);
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, cw, ch);
  } else {
    ctx.drawImage(bmp, 0, 0, iw, ih, 0, 0, cw, ch);
  }
  ctx.restore();
  return m;
}
function detailOverlayParams(tuning) {
  let alpha = 0.16;
  let contrast = 1.52;
  let sat = 1.06;
  switch (tuning.qualityPreset) {
    case "sharpen":
      alpha = 0.26;
      contrast = 1.68;
      sat = 1.04;
      break;
    case "denoise":
      alpha = 0.06;
      contrast = 1.22;
      sat = 1.02;
      break;
    case "color_correct":
      alpha = 0.14;
      contrast = 1.42;
      sat = 1.08;
      break;
    case "full_enhance":
    default:
      alpha = 0.18;
      contrast = 1.55;
      sat = 1.06;
      break;
  }
  if (tuning.lighting === "hdr") alpha *= 0.72;
  if (tuning.lighting === "evening") alpha *= 0.88;
  return {
    alpha: Math.min(0.32, Math.max(0.04, alpha)),
    filter: `contrast(${contrast}) saturate(${sat})`
  };
}
function applyDetailClarityPass(ctx, w, h, tuning) {
  const { alpha, filter } = detailOverlayParams(tuning);
  if (alpha < 0.02) return;
  const temp = document.createElement("canvas");
  temp.width = w;
  temp.height = h;
  const tctx = temp.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = alpha;
  ctx.filter = filter;
  ctx.drawImage(temp, 0, 0);
  ctx.restore();
  ctx.filter = "none";
}
function applyUpscaleDetailHint(ctx, w, h) {
  const temp = document.createElement("canvas");
  temp.width = w;
  temp.height = h;
  const tctx = temp.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.09;
  ctx.filter = "contrast(1.22) brightness(1.01)";
  ctx.drawImage(temp, 0, 0);
  ctx.restore();
  ctx.filter = "none";
}
async function enhanceImageLocally(source, tuning = defaultLocalTuning()) {
  const bmp = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    throw new Error("Canvas not available");
  }
  try {
    const { width: iw, height: ih } = bmp;
    const { w: cw, h: ch } = clampDimensionsToMaxPixels(iw, ih, MAX_CANVAS_PIXELS);
    const geo = document.createElement("canvas");
    geo.width = cw;
    geo.height = ch;
    const gctx = geo.getContext("2d");
    if (!gctx) throw new Error("Canvas not available");
    let autoRotationRad = 0;
    if (tuning.perspective === "align_verticals_auto") {
      autoRotationRad = estimateAutoRotationRad(bmp, "verticals");
    } else if (tuning.perspective === "level_horizon_auto") {
      autoRotationRad = estimateAutoRotationRad(bmp, "horizon");
    } else if (usesChangeAngleSobel(tuning.perspective)) {
      autoRotationRad = estimateAutoRotationRadCenterAngle(bmp);
    }
    const imageMatrix = drawWithPerspectiveGeometry(gctx, bmp, cw, ch, tuning.perspective, autoRotationRad);
    let geoOut = geo;
    let outW = cw;
    let outH = ch;
    if (imageMatrix && perspectiveUsesRotatedQuad(tuning.perspective)) {
      const b = tightCropBoundsForPerspectiveQuad(imageMatrix, iw, ih, cw, ch);
      if (b.w >= 2 && b.h >= 2 && (b.x > 0 || b.y > 0 || b.w < cw || b.h < ch)) {
        const cropped = document.createElement("canvas");
        cropped.width = b.w;
        cropped.height = b.h;
        const cctx = cropped.getContext("2d");
        if (cctx) {
          cctx.imageSmoothingEnabled = true;
          cctx.imageSmoothingQuality = "high";
          cctx.drawImage(geo, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
          geoOut = cropped;
          outW = b.w;
          outH = b.h;
        }
      }
    }
    if (listingAngleUsesHorizontalRecenter(tuning.perspective)) {
      const shifted = horizontallyRecenterListingCanvas(geoOut, tuning.perspective);
      if (shifted !== geoOut) {
        geoOut = shifted;
        outW = geoOut.width;
        outH = geoOut.height;
      }
    }
    canvas.width = outW;
    canvas.height = outH;
    ctx.filter = buildColorFilter(tuning);
    ctx.drawImage(geoOut, 0, 0);
    ctx.filter = "none";
    applyDetailClarityPass(ctx, outW, outH, tuning);
  } finally {
    bmp.close();
  }
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error("Could not encode image (canvas too large or out of memory).")),
      "image/png"
    );
  });
}
function mimeForOutputFormat(f) {
  if (f === "jpeg") return "image/jpeg";
  if (f === "webp") return "image/webp";
  return "image/png";
}
async function upscaleCanvasBlob(source, scale, opts) {
  const outputFormat = opts?.outputFormat ?? "png";
  const mime = mimeForOutputFormat(outputFormat);
  const quality = outputFormat === "png" ? void 0 : 0.92;
  if (scale <= 1.01 && outputFormat === "png") {
    return source;
  }
  const bmp = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    throw new Error("Canvas not available");
  }
  try {
    const { w, h } = upscaleDimensionsWithinCap(bmp.width, bmp.height, scale, MAX_CANVAS_PIXELS);
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    if (w > bmp.width * 1.15 || h > bmp.height * 1.15) {
      applyUpscaleDetailHint(ctx, w, h);
    }
  } finally {
    bmp.close();
  }
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(
        new Error(
          "Could not upscale this image in the browser \u2014 dimensions exceed safe canvas limits. Try 2\xD7 or a smaller source file."
        )
      ),
      mime,
      quality
    );
  });
}
async function resizeRasterBlobToPixelSize(source, tw, th, outputFormat) {
  const { w, h } = clampDimensionsToMaxPixels(tw, th, MAX_CANVAS_PIXELS);
  const mime = mimeForOutputFormat(outputFormat);
  const quality = outputFormat === "png" ? void 0 : 0.92;
  const bmp = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    throw new Error("Canvas not available");
  }
  try {
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
  } finally {
    bmp.close();
  }
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error("Could not encode resized image.")),
      mime,
      quality
    );
  });
}
export {
  defaultLocalTuning,
  enhanceImageLocally,
  resizeRasterBlobToPixelSize,
  upscaleCanvasBlob
};

import { clampDimensionsToMaxPixels, MAX_CANVAS_PIXELS, upscaleDimensionsWithinCap } from "./canvasSafe";
import { estimateAutoRotationRad } from "./perspectiveAuto";

export interface LocalEnhanceTuning {
  lighting: string | null;
  qualityPreset: string | null;
  perspective: string | null;
  roomType: string;
}

export function defaultLocalTuning(): LocalEnhanceTuning {
  return {
    lighting: "bright",
    qualityPreset: "full_enhance",
    perspective: null,
    roomType: "general",
  };
}

function lightingFilters(lighting: string | null): string[] {
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

function qualityFilters(preset: string | null): string[] {
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

function roomFilters(roomType: string): string[] {
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

/** Lighting / quality / room only — perspective is applied as canvas geometry first. */
function buildColorFilter(tuning: LocalEnhanceTuning): string {
  const parts = [
    ...lightingFilters(tuning.lighting),
    ...qualityFilters(tuning.qualityPreset),
    ...roomFilters(tuning.roomType),
  ];
  return parts.join(" ");
}

function perspectiveUsesRotatedQuad(perspective: string | null): boolean {
  return (
    perspective === "align_verticals_auto" ||
    perspective === "level_horizon_auto" ||
    perspective === "straighten"
  );
}

/**
 * Same transform stack as drawWithPerspectiveGeometry for quad-based modes (DOMMatrix post-multiply order).
 */
function getPerspectiveImageMatrix(
  cw: number,
  ch: number,
  perspective: string | null,
  autoRotationRad: number
): DOMMatrix | null {
  if (perspective === "align_verticals_auto" || perspective === "level_horizon_auto") {
    const m = new DOMMatrix();
    m.translateSelf(cw / 2, ch / 2);
    m.scaleSelf(0.88, 0.88);
    m.rotateSelf((autoRotationRad * 180) / Math.PI);
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

/** Tight axis-aligned crop that removes empty corners after rotation / shear (integer pixels, 1:1 copy). */
function tightCropBoundsForPerspectiveQuad(
  m: DOMMatrix,
  iw: number,
  ih: number,
  cw: number,
  ch: number
): { x: number; y: number; w: number; h: number } {
  const corners: [number, number][] = [
    [-iw / 2, -ih / 2],
    [iw / 2, -ih / 2],
    [iw / 2, ih / 2],
    [-iw / 2, ih / 2],
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
    h: Math.max(1, y2 - y),
  };
}

/**
 * Perspective as real geometry (Improve engine). CSS filters cannot straighten or undo lens bowing meaningfully.
 * - straighten: mild rotation + shear (visible deskew vs. a 0.2° filter).
 * - align_verticals_auto / level_horizon_auto: Sobel edge histogram → estimated roll, then rotate (browser-only).
 * - correct_distortion: center crop + stretch (reduces edge barrel / wide-angle stretch).
 *
 * Returns the image-space matrix for quad modes so callers can tight-crop without recomputing.
 */
function drawWithPerspectiveGeometry(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  cw: number,
  ch: number,
  perspective: string | null,
  autoRotationRad: number
): DOMMatrix | null {
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

/**
 * Soft-light overlay of a high-contrast copy — pops local contrast / perceived detail (clarity)
 * without a full unsharp mask (no giant ImageData buffers).
 */
function detailOverlayParams(tuning: LocalEnhanceTuning): { alpha: number; filter: string } {
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
    filter: `contrast(${contrast}) saturate(${sat})`,
  };
}

function applyDetailClarityPass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tuning: LocalEnhanceTuning
): void {
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

/** Light clarity pass after bilinear upscale — offsets some interpolation softness. */
function applyUpscaleDetailHint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
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

/**
 * Client-side enhancement (Canvas filters). Honors lighting, quality preset, perspective, and room type.
 * Custom prompts are not applied (generative-only).
 */
export async function enhanceImageLocally(
  source: Blob,
  tuning: LocalEnhanceTuning = defaultLocalTuning()
): Promise<Blob> {
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
    }
    const imageMatrix = drawWithPerspectiveGeometry(gctx, bmp, cw, ch, tuning.perspective, autoRotationRad);

    let geoOut: HTMLCanvasElement = geo;
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
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image (canvas too large or out of memory)."))),
      "image/png"
    );
  });
}

export async function upscaleCanvasBlob(source: Blob, scale: number): Promise<Blob> {
  if (scale <= 1.01) return source;
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
      (b) =>
        b
          ? resolve(b)
          : reject(
              new Error(
                "Could not upscale this image in the browser — dimensions exceed safe canvas limits. Try 2× or a smaller source file."
              )
            ),
      "image/png"
    );
  });
}

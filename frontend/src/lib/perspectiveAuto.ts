/**
 * Browser-side “auto” perspective: estimates roll from Sobel edge orientations
 * (no network — fast on a downscaled analysis pass).
 */

const DEG2RAD = Math.PI / 180;
/** Ignore tiny corrections; avoids noise jitter. */
const MIN_APPLY_RAD = 0.12 * DEG2RAD;
/** Cap correction so we don’t over-rotate ambiguous scenes. */
const MAX_CORRECT_RAD = 10 * DEG2RAD;
const ANALYSIS_MAX_EDGE = 440;

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * @param mode verticals — walls / façades (gradients ≈ horizontal). horizon — skies / ground lines (gradients ≈ vertical).
 * @returns radians to rotate the image (apply as canvas rotate(-angle) to deskew).
 */
export function estimateAutoRotationRad(bmp: ImageBitmap, mode: "verticals" | "horizon"): number {
  const iw = bmp.width;
  const ih = bmp.height;
  if (iw < 8 || ih < 8) return 0;

  const scale = Math.min(1, ANALYSIS_MAX_EDGE / Math.max(iw, ih));
  const w = Math.max(48, Math.floor(iw * scale));
  const h = Math.max(48, Math.floor(ih * scale));

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return 0;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";
  ctx.drawImage(bmp, 0, 0, w, h);

  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return 0;
  }

  const gray = new Float32Array(w * h);
  const d = data.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = luma(d[i], d[i + 1], d[i + 2]) / 255;
  }

  const nBins = 41;
  const span = 2 * MAX_CORRECT_RAD;
  const hist = new Float64Array(nBins);

  const innerW = w - 2;
  const innerH = h - 2;
  const nInner = innerW * innerH;
  if (nInner < 1) return 0;

  const gxBuf = new Float32Array(nInner);
  const gyBuf = new Float32Array(nInner);
  const magBuf = new Float32Array(nInner);

  let k = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++, k++) {
      const idx = y * w + x;
      const gx =
        -gray[idx - w - 1] +
        gray[idx - w + 1] +
        -2 * gray[idx - 1] +
        2 * gray[idx + 1] +
        -gray[idx + w - 1] +
        gray[idx + w + 1];
      const gy =
        -gray[idx - w - 1] -
        2 * gray[idx - w] -
        gray[idx - w + 1] +
        gray[idx + w - 1] +
        2 * gray[idx + w] +
        gray[idx + w + 1];
      gxBuf[k] = gx;
      gyBuf[k] = gy;
      magBuf[k] = Math.hypot(gx, gy);
    }
  }

  const sorted = new Float32Array(magBuf);
  sorted.sort();
  const thresh = sorted[Math.floor(sorted.length * 0.82)] || 0;
  if (thresh < 1e-9) return 0;

  for (k = 0; k < nInner; k++) {
    const mag = magBuf[k];
    if (mag < thresh) continue;
    const gx = gxBuf[k];
    const gy = gyBuf[k];

    let phi = Math.atan2(gy, gx);

    if (mode === "verticals") {
      if (phi > Math.PI / 2) phi -= Math.PI;
      if (phi < -Math.PI / 2) phi += Math.PI;
      if (Math.abs(phi) > 0.55) continue;
    } else {
      const nearPi2 = Math.abs(Math.abs(phi) - Math.PI / 2);
      if (nearPi2 > 0.55) continue;
      phi = phi > 0 ? phi - Math.PI / 2 : phi + Math.PI / 2;
      if (phi > Math.PI / 2) phi -= Math.PI;
      if (phi < -Math.PI / 2) phi += Math.PI;
    }

    const t = (phi + MAX_CORRECT_RAD) / span;
    const bi = Math.floor(Math.max(0, Math.min(nBins - 1, t * nBins)));
    hist[bi] += mag;
  }

  let peak = 0;
  let peakI = 0;
  for (let i = 0; i < nBins; i++) {
    if (hist[i] > peak) {
      peak = hist[i];
      peakI = i;
    }
  }
  if (peak < 1e-6) return 0;

  const i0 = Math.max(0, peakI - 1);
  const i2 = Math.min(nBins - 1, peakI + 1);
  const y0 = hist[i0];
  const y1 = hist[peakI];
  const y2 = hist[i2];
  const denom = y0 - 2 * y1 + y2;
  let deltaBin = 0;
  if (Math.abs(denom) > 1e-9) {
    deltaBin = 0.5 * (y0 - y2) / denom;
  }
  const binCenter = peakI + 0.5 + deltaBin;
  const angleRad = (binCenter / nBins) * span - MAX_CORRECT_RAD;
  const correction = -angleRad;
  if (Math.abs(correction) < MIN_APPLY_RAD) return 0;
  return Math.max(-MAX_CORRECT_RAD, Math.min(MAX_CORRECT_RAD, correction));
}

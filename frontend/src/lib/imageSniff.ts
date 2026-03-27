import { IMAGE_SNIFF_BYTES } from "./ingestConfig";

function readHead(file: File, max: number): Promise<Uint8Array> {
  const n = Math.min(max, file.size);
  if (n <= 0) return Promise.resolve(new Uint8Array(0));
  return file.slice(0, n).arrayBuffer().then((b) => new Uint8Array(b));
}

function eq(b: Uint8Array, offset: number, seq: readonly number[]): boolean {
  if (offset + seq.length > b.length) return false;
  for (let i = 0; i < seq.length; i++) {
    if (b[offset + i] !== seq[i]) return false;
  }
  return true;
}

/**
 * Binary / text heuristics for raster + SVG + common containerized still formats.
 * False negatives fall through to server/local PIL probe when applicable.
 */
export function matchImageMagic(head: Uint8Array): boolean {
  if (head.length < 4) return false;

  // JPEG
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
  // PNG
  if (eq(head, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true;
  // GIF
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) return true;
  // BMP
  if (head[0] === 0x42 && head[1] === 0x4d) return true;
  // TIFF little / big endian
  if (
    (head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0) ||
    (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0 && head[3] === 0x2a)
  ) {
    return true;
  }
  // WebP (RIFF....WEBP)
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return true;
  }
  // ICO
  if (head[0] === 0 && head[1] === 0 && head[2] === 1 && head[3] === 0) return true;
  // Photoshop PSD
  if (head[0] === 0x38 && head[1] === 0x42 && head[2] === 0x50 && head[3] === 0x53) return true;

  // ISO BMFF still-image brands only (avoids treating generic MP4 as a photo)
  if (head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const major = String.fromCharCode(head[8], head[9], head[10], head[11]).toLowerCase();
    const stillBrands = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis"]);
    if (stillBrands.has(major)) return true;
  }

  // JPEG XL codestream (0xFF 0x0A) — partial support downstream
  if (head[0] === 0xff && head[1] === 0x0a) return true;

  return false;
}

function looksLikeSvgText(sample: string): boolean {
  const t = sample.trimStart();
  if (/^<\?xml/i.test(t)) return /<svg[\s>/]/i.test(t);
  return /^<svg[\s>/]/i.test(t) || /^<!DOCTYPE\s+svg/i.test(t);
}

/**
 * True if the file is very likely an image we should ingest (any vendor / odd MIME).
 */
export async function isLikelyImageFile(file: File): Promise<boolean> {
  if (!file || file.size <= 0) return false;

  // Fast path: browser-reported raster/SVG types still confirm with magic/text when cheap
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/svg+xml") {
    const head = await readHead(file, Math.min(8192, file.size));
    const text = new TextDecoder("utf-8", { fatal: false }).decode(head);
    return looksLikeSvgText(text);
  }

  const head = await readHead(file, Math.min(IMAGE_SNIFF_BYTES, file.size));
  if (matchImageMagic(head)) return true;

  const asText = new TextDecoder("utf-8", { fatal: false }).decode(head);
  if (looksLikeSvgText(asText)) return true;

  // Last resort: declared image/* without recognized magic (some cameras / tools)
  if (mime.startsWith("image/") && mime !== "image/octet-stream") {
    return true;
  }

  return false;
}

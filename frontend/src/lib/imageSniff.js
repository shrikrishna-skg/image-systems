import { IMAGE_SNIFF_BYTES } from "./ingestConfig";
function readHead(file, max) {
  const n = Math.min(max, file.size);
  if (n <= 0) return Promise.resolve(new Uint8Array(0));
  return file.slice(0, n).arrayBuffer().then((b) => new Uint8Array(b));
}
function eq(b, offset, seq) {
  if (offset + seq.length > b.length) return false;
  for (let i = 0; i < seq.length; i++) {
    if (b[offset + i] !== seq[i]) return false;
  }
  return true;
}
function matchImageMagic(head) {
  if (head.length < 4) return false;
  if (head[0] === 255 && head[1] === 216 && head[2] === 255) return true;
  if (eq(head, 0, [137, 80, 78, 71, 13, 10, 26, 10])) return true;
  if (head[0] === 71 && head[1] === 73 && head[2] === 70 && head[3] === 56) return true;
  if (head[0] === 66 && head[1] === 77) return true;
  if (head[0] === 73 && head[1] === 73 && head[2] === 42 && head[3] === 0 || head[0] === 77 && head[1] === 77 && head[2] === 0 && head[3] === 42) {
    return true;
  }
  if (head.length >= 12 && head[0] === 82 && head[1] === 73 && head[2] === 70 && head[3] === 70 && head[8] === 87 && head[9] === 69 && head[10] === 66 && head[11] === 80) {
    return true;
  }
  if (head[0] === 0 && head[1] === 0 && head[2] === 1 && head[3] === 0) return true;
  if (head[0] === 56 && head[1] === 66 && head[2] === 80 && head[3] === 83) return true;
  if (head.length >= 12 && head[4] === 102 && head[5] === 116 && head[6] === 121 && head[7] === 112) {
    const major = String.fromCharCode(head[8], head[9], head[10], head[11]).toLowerCase();
    const stillBrands = /* @__PURE__ */ new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis"]);
    if (stillBrands.has(major)) return true;
  }
  if (head[0] === 255 && head[1] === 10) return true;
  return false;
}
function looksLikeSvgText(sample) {
  const t = sample.trimStart();
  if (/^<\?xml/i.test(t)) return /<svg[\s>/]/i.test(t);
  return /^<svg[\s>/]/i.test(t) || /^<!DOCTYPE\s+svg/i.test(t);
}
async function isLikelyImageFile(file) {
  if (!file || file.size <= 0) return false;
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/svg+xml") {
    const head2 = await readHead(file, Math.min(8192, file.size));
    const text = new TextDecoder("utf-8", { fatal: false }).decode(head2);
    return looksLikeSvgText(text);
  }
  const head = await readHead(file, Math.min(IMAGE_SNIFF_BYTES, file.size));
  if (matchImageMagic(head)) return true;
  const asText = new TextDecoder("utf-8", { fatal: false }).decode(head);
  if (looksLikeSvgText(asText)) return true;
  if (mime.startsWith("image/") && mime !== "image/octet-stream") {
    return true;
  }
  return false;
}
export {
  isLikelyImageFile,
  matchImageMagic
};

function formatDimensions(w, h) {
  const wOk = w != null && w > 0;
  const hOk = h != null && h > 0;
  if (wOk && hOk) return `${w} \xD7 ${h} px`;
  if (wOk || hOk) return `${wOk ? w : "?"} \xD7 ${hOk ? h : "?"} px`;
  return "\u2014";
}
function formatMegapixels(w, h) {
  if (w == null || h == null || w <= 0 || h <= 0) return null;
  const mp = w * h / 1e6;
  if (mp >= 100) return `${mp.toFixed(0)} MP`;
  if (mp >= 10) return `${mp.toFixed(1)} MP`;
  return `${mp.toFixed(2)} MP`;
}
function formatFileSize(bytes) {
  if (bytes == null || bytes < 0) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10485760 ? 2 : 1)} MB`;
}
function pctChange(before, after) {
  if (before <= 0 || after < 0) return null;
  const p = (after - before) / before * 100;
  if (!Number.isFinite(p)) return null;
  const rounded = Math.abs(p) >= 10 ? p.toFixed(0) : p.toFixed(1);
  if (p > 0) return `+${rounded}%`;
  if (p < 0) return `${rounded}%`;
  return "0%";
}
function formatSignedBytesDelta(before, after) {
  if (before <= 0 || after < 0) return null;
  const d = after - before;
  if (d === 0) return null;
  const abs = Math.abs(d);
  const label = abs < 1024 ? `${abs} B` : abs < 1024 * 1024 ? `${(abs / 1024).toFixed(1)} KB` : `${(abs / (1024 * 1024)).toFixed(2)} MB`;
  return d > 0 ? `+${label}` : `\u2212${label}`;
}
function resolvedWH(meta, intrinsic) {
  const w = meta.width ?? intrinsic?.w ?? null;
  const h = meta.height ?? intrinsic?.h ?? null;
  if (w != null && h != null && w > 0 && h > 0) return { w, h };
  return null;
}
export {
  formatDimensions,
  formatFileSize,
  formatMegapixels,
  formatSignedBytesDelta,
  pctChange,
  resolvedWH
};

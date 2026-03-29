const PRESET_MIN_PIXELS_HERO = 64e4;
const PRESET_MIN_PIXELS_WEB = 16e4;
const PRESET_MAX_PIXELS_SMALL = 4e4;
function defaultImageSizeFilter() {
  return { minPixels: 0, maxPixels: 0 };
}
function isSizeFilterActive(f) {
  return f.minPixels > 0 || f.maxPixels > 0;
}
function imagePassesSizeFilter(w, h, f) {
  if (w <= 0 || h <= 0) return false;
  const pixels = w * h;
  if (f.minPixels > 0 && pixels < f.minPixels) return false;
  if (f.maxPixels > 0 && pixels > f.maxPixels) return false;
  return true;
}
export {
  PRESET_MAX_PIXELS_SMALL,
  PRESET_MIN_PIXELS_HERO,
  PRESET_MIN_PIXELS_WEB,
  defaultImageSizeFilter,
  imagePassesSizeFilter,
  isSizeFilterActive
};

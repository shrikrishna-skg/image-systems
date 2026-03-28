export type AspectFilter = "any" | "landscape" | "portrait" | "square";

export type ImageDimFilter = {
  minWidth: number;
  minHeight: number;
  minShortSide: number;
  maxShortSide: number;
  minMegapixels: number;
  aspect: AspectFilter;
};

export function defaultImageDimFilter(): ImageDimFilter {
  return {
    minWidth: 0,
    minHeight: 0,
    minShortSide: 0,
    maxShortSide: 0,
    minMegapixels: 0,
    aspect: "any",
  };
}

export function isDimFilterActive(f: ImageDimFilter): boolean {
  return (
    f.minWidth > 0 ||
    f.minHeight > 0 ||
    f.minShortSide > 0 ||
    f.maxShortSide > 0 ||
    f.minMegapixels > 0 ||
    f.aspect !== "any"
  );
}

/** Pixel dimensions from a loaded &lt;img&gt; (naturalWidth/Height). */
export function imagePassesDimFilter(w: number, h: number, f: ImageDimFilter): boolean {
  if (w <= 0 || h <= 0) return false;
  if (f.minWidth > 0 && w < f.minWidth) return false;
  if (f.minHeight > 0 && h < f.minHeight) return false;
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  if (f.minShortSide > 0 && short < f.minShortSide) return false;
  if (f.maxShortSide > 0 && short > f.maxShortSide) return false;
  if (f.minMegapixels > 0 && (w * h) / 1_000_000 < f.minMegapixels) return false;
  if (f.aspect === "landscape" && w <= h * 1.02) return false;
  if (f.aspect === "portrait" && h <= w * 1.02) return false;
  if (f.aspect === "square") {
    const rw = w / Math.max(h, 1);
    if (rw < 0.88 || rw > 1.12) return false;
  }
  return true;
}

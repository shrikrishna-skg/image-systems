import { useState, useRef, useCallback, useEffect, type CSSProperties } from "react";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import {
  Loader2,
  Columns2,
  SplitSquareVertical,
  Maximize2,
  HardDrive,
  ChevronDown,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import client from "../../api/client";
import { suggestFilename } from "../../api/images";
import { getLocalBlob } from "../../lib/localImageStore";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import {
  appendSizeToFilename,
  buildExportStem,
  downloadFilenameStem,
  exportDownloadBlob,
} from "../../lib/downloadExport";
import FullscreenImageRegion from "../media/FullscreenImageRegion";
import OptimizedImage from "../media/OptimizedImage";

type ComparisonViewMode = "slider" | "sideBySide";

export interface ComparisonSizeMeta {
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  scaleFactor?: number | null;
}

interface Props {
  imageId: string;
  resultVersionId: string;
  originalMeta?: ComparisonSizeMeta | null;
  resultMeta?: ComparisonSizeMeta | null;
  /** Export stem hint (pipeline-style naming for the enhanced file). */
  resultVersionType?: string | null;
  /** When set, quick download uses AI basename (same as Download panel) when the API is available. */
  aiNamingProvider?: "openai" | "gemini" | null;
  originalFilename?: string;
  /** Larger vertical budget when preview is in browser fullscreen. */
  viewportMode?: "default" | "fullscreen";
  /**
   * Which layout to show first; also reapplied when imageId / resultVersionId changes
   * (e.g. workspace batch — pick another asset and land on side-by-side again).
   */
  defaultViewMode?: ComparisonViewMode;
}

function formatDimensions(w: number | null, h: number | null): string {
  const wOk = w != null && w > 0;
  const hOk = h != null && h > 0;
  if (wOk && hOk) return `${w} × ${h} px`;
  if (wOk || hOk) return `${wOk ? w : "?"} × ${hOk ? h : "?"} px`;
  return "—";
}

function formatMegapixels(w: number | null, h: number | null): string | null {
  if (w == null || h == null || w <= 0 || h <= 0) return null;
  const mp = (w * h) / 1_000_000;
  if (mp >= 100) return `${mp.toFixed(0)} MP`;
  if (mp >= 10) return `${mp.toFixed(1)} MP`;
  return `${mp.toFixed(2)} MP`;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10_485_760 ? 2 : 1)} MB`;
}

function pctChange(before: number, after: number): string | null {
  if (before <= 0 || after < 0) return null;
  const p = ((after - before) / before) * 100;
  if (!Number.isFinite(p)) return null;
  const rounded = Math.abs(p) >= 10 ? p.toFixed(0) : p.toFixed(1);
  if (p > 0) return `+${rounded}%`;
  if (p < 0) return `${rounded}%`;
  return "0%";
}

function formatSignedBytesDelta(before: number, after: number): string | null {
  if (before <= 0 || after < 0) return null;
  const d = after - before;
  if (d === 0) return null;
  const abs = Math.abs(d);
  const label = abs < 1024 ? `${abs} B` : abs < 1024 * 1024 ? `${(abs / 1024).toFixed(1)} KB` : `${(abs / (1024 * 1024)).toFixed(2)} MB`;
  return d > 0 ? `+${label}` : `−${label}`;
}

function resolvedWH(
  meta: ComparisonSizeMeta,
  intrinsic: { w: number; h: number } | null
): { w: number; h: number } | null {
  const w = meta.width ?? intrinsic?.w ?? null;
  const h = meta.height ?? intrinsic?.h ?? null;
  if (w != null && h != null && w > 0 && h > 0) return { w, h };
  return null;
}

function SizeComparisonCard({
  original,
  result,
  intrinsicBefore,
  intrinsicAfter,
  embedded = false,
}: {
  original: ComparisonSizeMeta;
  result: ComparisonSizeMeta;
  intrinsicBefore: { w: number; h: number } | null;
  intrinsicAfter: { w: number; h: number } | null;
  /** Lighter chrome when nested inside a collapsible. */
  embedded?: boolean;
}) {
  const ow = original.width ?? intrinsicBefore?.w ?? null;
  const oh = original.height ?? intrinsicBefore?.h ?? null;
  const rw = result.width ?? intrinsicAfter?.w ?? null;
  const rh = result.height ?? intrinsicAfter?.h ?? null;

  const oPx = ow != null && oh != null && ow > 0 && oh > 0 ? ow * oh : null;
  const rPx = rw != null && rh != null && rw > 0 && rh > 0 ? rw * rh : null;

  const pixelDelta = oPx != null && rPx != null && oPx > 0 ? pctChange(oPx, rPx) : null;
  const sizeDelta =
    original.fileSizeBytes != null &&
    original.fileSizeBytes > 0 &&
    result.fileSizeBytes != null &&
    result.fileSizeBytes >= 0
      ? pctChange(original.fileSizeBytes, result.fileSizeBytes)
      : null;

  const fileBytesDelta = formatSignedBytesDelta(
    original.fileSizeBytes ?? 0,
    result.fileSizeBytes ?? 0
  );
  const showFileBytesDelta =
    original.fileSizeBytes != null &&
    original.fileSizeBytes > 0 &&
    result.fileSizeBytes != null &&
    result.fileSizeBytes >= 0 &&
    fileBytesDelta != null;

  const oMp = formatMegapixels(ow, oh);
  const rMp = formatMegapixels(rw, rh);

  const shell = embedded
    ? "pt-1"
    : "rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white px-4 py-3";

  const innerBase = embedded
    ? "rounded-lg border border-slate-200/60 bg-white px-2.5 py-2"
    : "rounded-xl border border-slate-200/80 bg-white px-3 py-2.5";
  const innerEnhanced = embedded
    ? "rounded-lg border border-neutral-200/60 bg-neutral-50/90 px-2.5 py-2"
    : "rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5";
  const innerChange = embedded
    ? "rounded-lg border border-dashed border-slate-200/70 bg-slate-50/40 px-2.5 py-2 sm:flex sm:flex-col sm:justify-center"
    : "rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 sm:flex sm:flex-col sm:justify-center";
  const labelMb = embedded ? "mb-1" : "mb-2";

  return (
    <div className={shell}>
      {!embedded && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Size comparison</p>
      )}
      <div className={`grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3`}>
        <div className={innerBase}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${labelMb}`}>Original</p>
          <div className="flex items-start gap-2 text-sm text-slate-800">
            <Maximize2 className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" strokeWidth={2} />
            <div>
              <p className="font-medium tabular-nums">{formatDimensions(ow, oh)}</p>
              {oMp && <p className="text-xs text-slate-500 mt-0.5">{oMp}</p>}
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-slate-700 mt-2">
            <HardDrive className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" strokeWidth={2} />
            <p className="font-medium tabular-nums">{formatFileSize(original.fileSizeBytes)}</p>
          </div>
        </div>

        <div className={innerEnhanced}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider text-neutral-600 ${labelMb}`}>Enhanced</p>
          <div className="flex items-start gap-2 text-sm text-neutral-900">
            <Maximize2 className="h-4 w-4 shrink-0 text-neutral-500 mt-0.5" strokeWidth={2} />
            <div>
              <p className="font-medium tabular-nums">{formatDimensions(rw, rh)}</p>
              {rMp && <p className="text-xs text-slate-600 mt-0.5">{rMp}</p>}
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-slate-800 mt-2">
            <HardDrive className="h-4 w-4 shrink-0 text-neutral-500 mt-0.5" strokeWidth={2} />
            <p className="font-medium tabular-nums">{formatFileSize(result.fileSizeBytes)}</p>
          </div>
          {result.scaleFactor != null && result.scaleFactor > 1 && (
            <p className="text-[11px] text-black font-medium mt-2">
              Upscale ×{result.scaleFactor}
            </p>
          )}
        </div>

        <div className={innerChange}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${labelMb}`}>Change</p>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {pixelDelta && (
              <li>
                <span className="text-slate-500">Pixels: </span>
                <span className="font-semibold tabular-nums text-slate-900">{pixelDelta}</span>
              </li>
            )}
            {sizeDelta && (
              <li>
                <span className="text-slate-500">File: </span>
                <span className="font-semibold tabular-nums text-slate-900">{sizeDelta}</span>
                {showFileBytesDelta && (
                  <span className="block text-xs font-normal text-slate-500 mt-0.5 tabular-nums">
                    ({fileBytesDelta})
                  </span>
                )}
              </li>
            )}
            {!pixelDelta && !sizeDelta && (
              <li className="text-slate-500 text-xs leading-relaxed">
                Run finishes with full metadata to see dimension and file-size deltas. Dimensions may fill in
                from the image after load.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function BeforeAfterSlider({
  imageId,
  resultVersionId,
  originalMeta,
  resultMeta,
  resultVersionType = null,
  aiNamingProvider = null,
  originalFilename = "photo",
  viewportMode = "default",
  defaultViewMode = "slider",
}: Props) {
  const [viewMode, setViewMode] = useState<ComparisonViewMode>(defaultViewMode);
  const [sliderPos, setSliderPos] = useState(50);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [intrinsicBefore, setIntrinsicBefore] = useState<{ w: number; h: number } | null>(null);
  const [intrinsicAfter, setIntrinsicAfter] = useState<{ w: number; h: number } | null>(null);
  const [enhancedDownloading, setEnhancedDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const storageOnly = isStorageOnlyMode();

  const oMeta: ComparisonSizeMeta = originalMeta ?? { width: null, height: null, fileSizeBytes: null };
  const rMeta: ComparisonSizeMeta = resultMeta ?? { width: null, height: null, fileSizeBytes: null };

  useEffect(() => {
    setViewMode(defaultViewMode);
  }, [imageId, resultVersionId, defaultViewMode]);

  useEffect(() => {
    queueMicrotask(() => {
      setIntrinsicBefore(null);
      setIntrinsicAfter(null);
    });
  }, [imageId, resultVersionId]);

  useEffect(() => {
    if (viewMode !== "slider") return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.offsetWidth));
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, [viewMode]);

  const { blobUrl: beforeUrl, loading: beforeLoading } = useAuthenticatedImage(imageId);
  const { blobUrl: afterUrl, loading: afterLoading } = useAuthenticatedImage(imageId, resultVersionId);

  const loading = beforeLoading || afterLoading;

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      updatePosition(e.clientX);
    },
    [updatePosition]
  );

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      updatePosition(e.touches[0].clientX);
    },
    [updatePosition]
  );

  const onBeforeImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setIntrinsicBefore({ w: naturalWidth, h: naturalHeight });
    }
  }, []);

  const onAfterImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setIntrinsicAfter({ w: naturalWidth, h: naturalHeight });
    }
  }, []);

  const downloadEnhanced = useCallback(async () => {
    setEnhancedDownloading(true);
    try {
      let blob: Blob;
      if (storageOnly) {
        const b = await getLocalBlob(imageId, resultVersionId);
        if (!b) throw new Error("Not found");
        blob = b;
      } else {
        const res = await client.get(`/images/${imageId}/download`, {
          params: { version: resultVersionId },
          responseType: "blob",
        });
        blob = res.data;
      }

      const rw = rMeta.width ?? intrinsicAfter?.w ?? null;
      const rh = rMeta.height ?? intrinsicAfter?.h ?? null;
      let stem: string;
      if (aiNamingProvider && !storageOnly) {
        try {
          const data = await suggestFilename(imageId, {
            version: resultVersionId,
            provider: aiNamingProvider,
          });
          stem = buildExportStem({
            preset: "pipeline",
            customBase: "",
            aiBase: data.basename,
            originalFilename,
            kind: "version",
            versionType: resultVersionType ?? undefined,
            width: rw,
            height: rh,
          });
        } catch {
          stem = downloadFilenameStem("version", resultVersionType ?? undefined, rw, rh);
        }
      } else {
        stem = downloadFilenameStem("version", resultVersionType ?? undefined, rw, rh);
      }
      const { blob: out, extension } = await exportDownloadBlob(blob, "png_lossless", "full");
      const filename = appendSizeToFilename(stem, "full", extension);

      const blobUrl = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      const mb = (out.size / (1024 * 1024)).toFixed(1);
      toast.success("Download started", {
        description: `${filename} · about ${mb} MB`,
      });
    } catch {
      toast.error("Download failed", {
        description: "Use Download results below for more format options.",
      });
    } finally {
      setEnhancedDownloading(false);
    }
  }, [
    storageOnly,
    imageId,
    resultVersionId,
    rMeta.width,
    rMeta.height,
    intrinsicAfter?.w,
    intrinsicAfter?.h,
    resultVersionType,
    aiNamingProvider,
    originalFilename,
  ]);

  const enhancedDownloadButton = (
    <button
      type="button"
      onClick={() => void downloadEnhanced()}
      disabled={enhancedDownloading || loading}
      aria-label="Download enhanced image"
      title="Download enhanced image (PNG lossless, full size; AI filename when keys are configured)"
      className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black transition-colors hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-50"
    >
      {enhancedDownloading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
      ) : (
        <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      )}
      <span className="hidden sm:inline">Download</span>
    </button>
  );

  if (loading || !beforeUrl || !afterUrl) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
        <p className="ml-3 text-sm text-slate-500">Loading comparison…</p>
      </div>
    );
  }

  const maxH =
    viewportMode === "fullscreen" ? "min(92vh, 1400px)" : "min(500px, 70vh)";
  const compareRowMaxH =
    viewportMode === "fullscreen" ? "min(88vh, 1200px)" : "min(560px, 68vh)";
  const imgMaxStyle: CSSProperties = { maxHeight: maxH };

  const beforeDims = resolvedWH(oMeta, intrinsicBefore);
  const afterDims = resolvedWH(rMeta, intrinsicAfter);

  const sideBySidePaneStyle: CSSProperties = {
    height: compareRowMaxH,
    minHeight: compareRowMaxH,
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-600 sm:text-xs leading-snug max-w-xl">
          <span className="font-semibold text-slate-800">Compare</span>
          {viewMode === "sideBySide" ? (
            <>
              {" "}
              · original and improved <span className="text-slate-700">side by side</span>. Use{" "}
              <span className="font-medium text-slate-700">Slider</span> for a draggable before/after wipe.
            </>
          ) : (
            <>
              {" "}
              · drag the divider. Use <span className="font-medium text-slate-700">Side by side</span> for two
              full panels.
            </>
          )}
        </p>
        <div
          className="inline-flex shrink-0 rounded-lg border border-slate-200/80 bg-slate-50 p-0.5"
          role="group"
          aria-label="Comparison layout"
        >
          <button
            type="button"
            onClick={() => setViewMode("sideBySide")}
            aria-pressed={viewMode === "sideBySide"}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
              viewMode === "sideBySide"
                ? "bg-black text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <Columns2 className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Side by side</span>
            <span className="sm:hidden">2-up</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("slider")}
            aria-pressed={viewMode === "slider"}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
              viewMode === "slider"
                ? "bg-black text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <SplitSquareVertical className="h-3.5 w-3.5" strokeWidth={2} />
            Slider
          </button>
        </div>
      </div>

      <details className="group rounded-lg border border-slate-200/60 bg-slate-50/30 open:border-slate-200/80 open:bg-slate-50/50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-medium text-slate-700 select-none [&::-webkit-details-marker]:hidden">
          <span>Technical details — dimensions, file size, deltas</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="border-t border-slate-200/50 px-2 pb-2 pt-1 sm:px-3 sm:pb-3">
          <SizeComparisonCard
            original={oMeta}
            result={rMeta}
            intrinsicBefore={intrinsicBefore}
            intrinsicAfter={intrinsicAfter}
            embedded
          />
        </div>
      </details>

      {viewMode === "sideBySide" ? (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 leading-snug px-0.5">
            Same-size panels · <strong className="text-slate-700">contain</strong> fit · labels show true pixels.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-0 lg:rounded-2xl lg:border lg:border-slate-200/90 lg:overflow-hidden">
            <figure className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50 lg:rounded-none lg:border-0 lg:border-r lg:border-slate-200/90">
              <figcaption className="border-b border-slate-200/80 bg-white px-3 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Original
                </span>
                <p className="text-xs font-data text-slate-700 tabular-nums mt-1">
                  {beforeDims
                    ? `${beforeDims.w} × ${beforeDims.h} px${
                        formatMegapixels(beforeDims.w, beforeDims.h)
                          ? ` · ${formatMegapixels(beforeDims.w, beforeDims.h)}`
                          : ""
                      }`
                    : "Reading dimensions…"}
                </p>
              </figcaption>
              <FullscreenImageRegion className="flex min-h-0 flex-1 flex-col">
                <div className="box-border w-full bg-slate-100/70 p-2 sm:p-3" style={sideBySidePaneStyle}>
                  <OptimizedImage
                    priority
                    src={beforeUrl}
                    alt="Original"
                    className="h-full w-full object-contain object-center select-none"
                    draggable={false}
                    onLoad={onBeforeImgLoad}
                  />
                </div>
              </FullscreenImageRegion>
            </figure>
            <figure className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-50 lg:rounded-none lg:border-0">
              <figcaption className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-white px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-black">
                    Enhanced
                  </span>
                  <p className="text-xs font-data text-slate-800 tabular-nums mt-1">
                    {afterDims
                      ? `${afterDims.w} × ${afterDims.h} px${
                          formatMegapixels(afterDims.w, afterDims.h)
                            ? ` · ${formatMegapixels(afterDims.w, afterDims.h)}`
                            : ""
                        }`
                      : "Reading dimensions…"}
                    {rMeta.scaleFactor != null && rMeta.scaleFactor > 1 && (
                      <span className="block text-[11px] font-semibold text-black mt-1">
                        Upscale ×{rMeta.scaleFactor}
                      </span>
                    )}
                  </p>
                </div>
                {enhancedDownloadButton}
              </figcaption>
              <FullscreenImageRegion className="flex min-h-0 flex-1 flex-col">
                <div className="box-border w-full bg-neutral-100/80 p-2 sm:p-3" style={sideBySidePaneStyle}>
                  <OptimizedImage
                    priority
                    src={afterUrl}
                    alt="Enhanced"
                    className="h-full w-full object-contain object-center select-none"
                    draggable={false}
                    onLoad={onAfterImgLoad}
                  />
                </div>
              </FullscreenImageRegion>
            </figure>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">Original</span>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-black border border-neutral-200">
                Enhanced
              </span>
              {enhancedDownloadButton}
            </div>
          </div>
          <FullscreenImageRegion className="w-full">
            <div
              ref={containerRef}
              className="relative cursor-col-resize select-none overflow-hidden rounded-2xl border border-slate-200/90"
              style={{ maxHeight: maxH }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchMove={handleTouchMove}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
            >
              <OptimizedImage
                priority
                src={afterUrl}
                alt="Enhanced"
                className="block w-full"
                style={{ ...imgMaxStyle, objectFit: "contain" }}
                draggable={false}
                onLoad={onAfterImgLoad}
              />

              <div
                className="absolute left-0 top-0 h-full overflow-hidden"
                style={{ width: `${sliderPos}%` }}
              >
                <OptimizedImage
                  priority
                  src={beforeUrl}
                  alt="Original"
                  className="block"
                  style={{
                    ...imgMaxStyle,
                    objectFit: "contain",
                    width: containerWidth ?? "100%",
                  }}
                  draggable={false}
                  onLoad={onBeforeImgLoad}
                />
              </div>

              <div
                className="absolute top-0 h-full w-0.5 bg-white ring-1 ring-black/10"
                style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
              >
                <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white ring-1 ring-black/[0.08]">
                  <div className="flex gap-0.5">
                    <div className="h-4 w-0.5 rounded bg-slate-400" />
                    <div className="h-4 w-0.5 rounded bg-slate-400" />
                  </div>
                </div>
              </div>
            </div>
          </FullscreenImageRegion>
        </>
      )}
    </div>
  );
}

import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import {
  Loader2,
  Columns2,
  SplitSquareVertical,
  Maximize2,
  HardDrive,
  ChevronDown,
  Download
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
  exportDownloadBlob
} from "../../lib/downloadExport";
import {
  formatDimensions,
  formatFileSize,
  formatMegapixels,
  formatSignedBytesDelta,
  pctChange,
  resolvedWH
} from "../../lib/comparisonFormatters";
import FullscreenImageRegion from "../media/FullscreenImageRegion";
import OptimizedImage from "../media/OptimizedImage";
function SizeComparisonCard({
  original,
  result,
  intrinsicBefore,
  intrinsicAfter,
  embedded = false
}) {
  const ow = original.width ?? intrinsicBefore?.w ?? null;
  const oh = original.height ?? intrinsicBefore?.h ?? null;
  const rw = result.width ?? intrinsicAfter?.w ?? null;
  const rh = result.height ?? intrinsicAfter?.h ?? null;
  const oPx = ow != null && oh != null && ow > 0 && oh > 0 ? ow * oh : null;
  const rPx = rw != null && rh != null && rw > 0 && rh > 0 ? rw * rh : null;
  const pixelDelta = oPx != null && rPx != null && oPx > 0 ? pctChange(oPx, rPx) : null;
  const sizeDelta = original.fileSizeBytes != null && original.fileSizeBytes > 0 && result.fileSizeBytes != null && result.fileSizeBytes >= 0 ? pctChange(original.fileSizeBytes, result.fileSizeBytes) : null;
  const fileBytesDelta = formatSignedBytesDelta(
    original.fileSizeBytes ?? 0,
    result.fileSizeBytes ?? 0
  );
  const showFileBytesDelta = original.fileSizeBytes != null && original.fileSizeBytes > 0 && result.fileSizeBytes != null && result.fileSizeBytes >= 0 && fileBytesDelta != null;
  const oMp = formatMegapixels(ow, oh);
  const rMp = formatMegapixels(rw, rh);
  const shell = embedded ? "pt-1" : "rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white px-4 py-3";
  const innerBase = embedded ? "rounded-lg border border-slate-200/60 bg-white px-2.5 py-2" : "rounded-xl border border-slate-200/80 bg-white px-3 py-2.5";
  const innerEnhanced = embedded ? "rounded-lg border border-neutral-200/60 bg-neutral-50/90 px-2.5 py-2" : "rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5";
  const innerChange = embedded ? "rounded-lg border border-dashed border-slate-200/70 bg-slate-50/40 px-2.5 py-2 sm:flex sm:flex-col sm:justify-center" : "rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 sm:flex sm:flex-col sm:justify-center";
  const labelMb = embedded ? "mb-1" : "mb-2";
  return /* @__PURE__ */ jsxs("div", { className: shell, children: [
    !embedded && /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3", children: "Size comparison" }),
    /* @__PURE__ */ jsxs("div", { className: `grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3`, children: [
      /* @__PURE__ */ jsxs("div", { className: innerBase, children: [
        /* @__PURE__ */ jsx("p", { className: `text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${labelMb}`, children: "Original" }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 text-sm text-slate-800", children: [
          /* @__PURE__ */ jsx(Maximize2, { className: "h-4 w-4 shrink-0 text-slate-400 mt-0.5", strokeWidth: 2 }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-medium tabular-nums", children: formatDimensions(ow, oh) }),
            oMp && /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: oMp })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 text-sm text-slate-700 mt-2", children: [
          /* @__PURE__ */ jsx(HardDrive, { className: "h-4 w-4 shrink-0 text-slate-400 mt-0.5", strokeWidth: 2 }),
          /* @__PURE__ */ jsx("p", { className: "font-medium tabular-nums", children: formatFileSize(original.fileSizeBytes) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: innerEnhanced, children: [
        /* @__PURE__ */ jsx("p", { className: `text-[10px] font-semibold uppercase tracking-wider text-neutral-600 ${labelMb}`, children: "Enhanced" }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 text-sm text-neutral-900", children: [
          /* @__PURE__ */ jsx(Maximize2, { className: "h-4 w-4 shrink-0 text-neutral-500 mt-0.5", strokeWidth: 2 }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-medium tabular-nums", children: formatDimensions(rw, rh) }),
            rMp && /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-600 mt-0.5", children: rMp })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 text-sm text-slate-800 mt-2", children: [
          /* @__PURE__ */ jsx(HardDrive, { className: "h-4 w-4 shrink-0 text-neutral-500 mt-0.5", strokeWidth: 2 }),
          /* @__PURE__ */ jsx("p", { className: "font-medium tabular-nums", children: formatFileSize(result.fileSizeBytes) })
        ] }),
        result.scaleFactor != null && result.scaleFactor > 1 && /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-black font-medium mt-2", children: [
          "Upscale \xD7",
          result.scaleFactor
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: innerChange, children: [
        /* @__PURE__ */ jsx("p", { className: `text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${labelMb}`, children: "Change" }),
        /* @__PURE__ */ jsxs("ul", { className: "space-y-1.5 text-sm text-slate-700", children: [
          pixelDelta && /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("span", { className: "text-slate-500", children: "Pixels: " }),
            /* @__PURE__ */ jsx("span", { className: "font-semibold tabular-nums text-slate-900", children: pixelDelta })
          ] }),
          sizeDelta && /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("span", { className: "text-slate-500", children: "File: " }),
            /* @__PURE__ */ jsx("span", { className: "font-semibold tabular-nums text-slate-900", children: sizeDelta }),
            showFileBytesDelta && /* @__PURE__ */ jsxs("span", { className: "block text-xs font-normal text-slate-500 mt-0.5 tabular-nums", children: [
              "(",
              fileBytesDelta,
              ")"
            ] })
          ] }),
          !pixelDelta && !sizeDelta && /* @__PURE__ */ jsx("li", { className: "text-slate-500 text-xs leading-relaxed", children: "Run finishes with full metadata to see dimension and file-size deltas. Dimensions may fill in from the image after load." })
        ] })
      ] })
    ] })
  ] });
}
function BeforeAfterSlider({
  imageId,
  resultVersionId,
  originalMeta,
  resultMeta,
  resultVersionType = null,
  aiNamingProvider = null,
  originalFilename = "photo",
  viewportMode = "default",
  defaultViewMode = "slider"
}) {
  const [viewMode, setViewMode] = useState(defaultViewMode);
  const [sliderPos, setSliderPos] = useState(50);
  const [containerWidth, setContainerWidth] = useState(null);
  const [intrinsicBefore, setIntrinsicBefore] = useState(null);
  const [intrinsicAfter, setIntrinsicAfter] = useState(null);
  const [enhancedDownloading, setEnhancedDownloading] = useState(false);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const storageOnly = isStorageOnlyMode();
  const oMeta = originalMeta ?? { width: null, height: null, fileSizeBytes: null };
  const rMeta = resultMeta ?? { width: null, height: null, fileSizeBytes: null };
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
  const updatePosition = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, x / rect.width * 100));
    setSliderPos(pct);
  }, []);
  const handleMouseDown = () => {
    isDragging.current = true;
  };
  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging.current) return;
      updatePosition(e.clientX);
    },
    [updatePosition]
  );
  const handleMouseUp = () => {
    isDragging.current = false;
  };
  const handleTouchMove = useCallback(
    (e) => {
      updatePosition(e.touches[0].clientX);
    },
    [updatePosition]
  );
  const onBeforeImgLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setIntrinsicBefore({ w: naturalWidth, h: naturalHeight });
    }
  }, []);
  const onAfterImgLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setIntrinsicAfter({ w: naturalWidth, h: naturalHeight });
    }
  }, []);
  const downloadEnhanced = useCallback(async () => {
    setEnhancedDownloading(true);
    try {
      let blob;
      if (storageOnly) {
        const b = await getLocalBlob(imageId, resultVersionId);
        if (!b) throw new Error("Not found");
        blob = b;
      } else {
        const res = await client.get(`/images/${imageId}/download`, {
          params: { version: resultVersionId },
          responseType: "blob"
        });
        blob = res.data;
      }
      const rw = rMeta.width ?? intrinsicAfter?.w ?? null;
      const rh = rMeta.height ?? intrinsicAfter?.h ?? null;
      let stem;
      if (aiNamingProvider && !storageOnly) {
        try {
          const data = await suggestFilename(imageId, {
            version: resultVersionId,
            provider: aiNamingProvider
          });
          stem = buildExportStem({
            preset: "pipeline",
            customBase: "",
            aiBase: data.basename,
            originalFilename,
            kind: "version",
            versionType: resultVersionType ?? void 0,
            width: rw,
            height: rh
          });
        } catch {
          stem = downloadFilenameStem("version", resultVersionType ?? void 0, rw, rh);
        }
      } else {
        stem = downloadFilenameStem("version", resultVersionType ?? void 0, rw, rh);
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
        description: `${filename} \xB7 about ${mb} MB`
      });
    } catch {
      toast.error("Download failed", {
        description: "Use Download results below for more format options."
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
    originalFilename
  ]);
  const enhancedDownloadButton = /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      onClick: () => void downloadEnhanced(),
      disabled: enhancedDownloading || loading,
      "aria-label": "Download enhanced image",
      title: "Download enhanced image (PNG lossless, full size; AI filename when keys are configured)",
      className: "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black transition-colors hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-50",
      children: [
        enhancedDownloading ? /* @__PURE__ */ jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", strokeWidth: 2, "aria-hidden": true }) : /* @__PURE__ */ jsx(Download, { className: "h-3.5 w-3.5", strokeWidth: 2, "aria-hidden": true }),
        /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Download" })
      ]
    }
  );
  if (loading || !beforeUrl || !afterUrl) {
    return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center py-16", children: [
      /* @__PURE__ */ jsx(Loader2, { className: "w-8 h-8 animate-spin text-black" }),
      /* @__PURE__ */ jsx("p", { className: "ml-3 text-sm text-slate-500", children: "Loading comparison\u2026" })
    ] });
  }
  const maxH = viewportMode === "fullscreen" ? "min(92vh, 1400px)" : "min(500px, 70vh)";
  const compareRowMaxH = viewportMode === "fullscreen" ? "min(88vh, 1200px)" : "min(560px, 68vh)";
  const imgMaxStyle = { maxHeight: maxH };
  const beforeDims = resolvedWH(oMeta, intrinsicBefore);
  const afterDims = resolvedWH(rMeta, intrinsicAfter);
  const sideBySidePaneStyle = {
    height: compareRowMaxH,
    minHeight: compareRowMaxH
  };
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2 sm:space-y-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-slate-600 sm:text-xs leading-snug max-w-xl", children: [
        /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-800", children: "Compare" }),
        viewMode === "sideBySide" ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " ",
          "\xB7 original and improved ",
          /* @__PURE__ */ jsx("span", { className: "text-slate-700", children: "side by side" }),
          ". Use",
          " ",
          /* @__PURE__ */ jsx("span", { className: "font-medium text-slate-700", children: "Slider" }),
          " for a draggable before/after wipe."
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          " ",
          "\xB7 drag the divider. Use ",
          /* @__PURE__ */ jsx("span", { className: "font-medium text-slate-700", children: "Side by side" }),
          " for two full panels."
        ] })
      ] }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: "inline-flex shrink-0 rounded-lg border border-slate-200/80 bg-slate-50 p-0.5",
          role: "group",
          "aria-label": "Comparison layout",
          children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setViewMode("sideBySide"),
                "aria-pressed": viewMode === "sideBySide",
                className: `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${viewMode === "sideBySide" ? "bg-black text-white" : "text-neutral-600 hover:text-black"}`,
                children: [
                  /* @__PURE__ */ jsx(Columns2, { className: "h-3.5 w-3.5", strokeWidth: 2 }),
                  /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Side by side" }),
                  /* @__PURE__ */ jsx("span", { className: "sm:hidden", children: "2-up" })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setViewMode("slider"),
                "aria-pressed": viewMode === "slider",
                className: `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${viewMode === "slider" ? "bg-black text-white" : "text-neutral-600 hover:text-black"}`,
                children: [
                  /* @__PURE__ */ jsx(SplitSquareVertical, { className: "h-3.5 w-3.5", strokeWidth: 2 }),
                  "Slider"
                ]
              }
            )
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("details", { className: "group rounded-lg border border-slate-200/60 bg-slate-50/30 open:border-slate-200/80 open:bg-slate-50/50", children: [
      /* @__PURE__ */ jsxs("summary", { className: "flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-medium text-slate-700 select-none [&::-webkit-details-marker]:hidden", children: [
        /* @__PURE__ */ jsx("span", { children: "Technical details \u2014 dimensions, file size, deltas" }),
        /* @__PURE__ */ jsx(
          ChevronDown,
          {
            className: "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180",
            "aria-hidden": true
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "border-t border-slate-200/50 px-2 pb-2 pt-1 sm:px-3 sm:pb-3", children: /* @__PURE__ */ jsx(
        SizeComparisonCard,
        {
          original: oMeta,
          result: rMeta,
          intrinsicBefore,
          intrinsicAfter,
          embedded: true
        }
      ) })
    ] }),
    viewMode === "sideBySide" ? /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-slate-500 leading-snug px-0.5", children: [
        "Same-size panels \xB7 ",
        /* @__PURE__ */ jsx("strong", { className: "text-slate-700", children: "contain" }),
        " fit \xB7 labels show true pixels."
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-0 lg:overflow-hidden", children: [
        /* @__PURE__ */ jsxs("figure", { className: "flex min-h-0 flex-col overflow-hidden rounded-2xl bg-slate-50 lg:rounded-none", children: [
          /* @__PURE__ */ jsxs("figcaption", { className: "border-b border-slate-200/80 bg-white px-3 py-2.5", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500", children: "Original" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs font-data text-slate-700 tabular-nums mt-1", children: beforeDims ? `${beforeDims.w} \xD7 ${beforeDims.h} px${formatMegapixels(beforeDims.w, beforeDims.h) ? ` \xB7 ${formatMegapixels(beforeDims.w, beforeDims.h)}` : ""}` : "Reading dimensions\u2026" })
          ] }),
          /* @__PURE__ */ jsx(FullscreenImageRegion, { className: "flex min-h-0 flex-1 flex-col", children: /* @__PURE__ */ jsx("div", { className: "box-border w-full bg-slate-100/70 p-0", style: sideBySidePaneStyle, children: /* @__PURE__ */ jsx(
            OptimizedImage,
            {
              priority: true,
              src: beforeUrl,
              alt: "Original",
              className: "h-full w-full object-contain object-center select-none",
              draggable: false,
              onLoad: onBeforeImgLoad
            }
          ) }) })
        ] }),
        /* @__PURE__ */ jsxs("figure", { className: "flex min-h-0 flex-col overflow-hidden rounded-2xl bg-neutral-50 lg:rounded-none", children: [
          /* @__PURE__ */ jsxs("figcaption", { className: "flex items-start justify-between gap-3 border-b border-neutral-200 bg-white px-3 py-2.5", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-black", children: "Enhanced" }),
              /* @__PURE__ */ jsxs("p", { className: "text-xs font-data text-slate-800 tabular-nums mt-1", children: [
                afterDims ? `${afterDims.w} \xD7 ${afterDims.h} px${formatMegapixels(afterDims.w, afterDims.h) ? ` \xB7 ${formatMegapixels(afterDims.w, afterDims.h)}` : ""}` : "Reading dimensions\u2026",
                rMeta.scaleFactor != null && rMeta.scaleFactor > 1 && /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-black mt-1", children: [
                  "Upscale \xD7",
                  rMeta.scaleFactor
                ] })
              ] })
            ] }),
            enhancedDownloadButton
          ] }),
          /* @__PURE__ */ jsx(FullscreenImageRegion, { className: "flex min-h-0 flex-1 flex-col", children: /* @__PURE__ */ jsx("div", { className: "box-border w-full bg-neutral-100/80 p-0", style: sideBySidePaneStyle, children: /* @__PURE__ */ jsx(
            OptimizedImage,
            {
              priority: true,
              src: afterUrl,
              alt: "Enhanced",
              className: "h-full w-full object-contain object-center select-none",
              draggable: false,
              onLoad: onAfterImgLoad
            }
          ) }) })
        ] })
      ] })
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider", children: [
        /* @__PURE__ */ jsx("span", { className: "rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600", children: "Original" }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "rounded-lg bg-neutral-100 px-2.5 py-1 text-black border border-neutral-200", children: "Enhanced" }),
          enhancedDownloadButton
        ] })
      ] }),
      /* @__PURE__ */ jsx(FullscreenImageRegion, { className: "w-full", children: /* @__PURE__ */ jsxs(
        "div",
        {
          ref: containerRef,
          className: "relative cursor-col-resize select-none overflow-hidden rounded-2xl",
          style: { maxHeight: maxH },
          onMouseDown: handleMouseDown,
          onMouseMove: handleMouseMove,
          onMouseUp: handleMouseUp,
          onMouseLeave: handleMouseUp,
          onTouchMove: handleTouchMove,
          onTouchStart: handleMouseDown,
          onTouchEnd: handleMouseUp,
          children: [
            /* @__PURE__ */ jsx(
              OptimizedImage,
              {
                priority: true,
                src: afterUrl,
                alt: "Enhanced",
                className: "block w-full",
                style: { ...imgMaxStyle, objectFit: "contain" },
                draggable: false,
                onLoad: onAfterImgLoad
              }
            ),
            /* @__PURE__ */ jsx(
              "div",
              {
                className: "absolute left-0 top-0 h-full overflow-hidden",
                style: { width: `${sliderPos}%` },
                children: /* @__PURE__ */ jsx(
                  OptimizedImage,
                  {
                    priority: true,
                    src: beforeUrl,
                    alt: "Original",
                    className: "block",
                    style: {
                      ...imgMaxStyle,
                      objectFit: "contain",
                      width: containerWidth ?? "100%"
                    },
                    draggable: false,
                    onLoad: onBeforeImgLoad
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              "div",
              {
                className: "absolute top-0 h-full w-0.5 bg-white ring-1 ring-black/10",
                style: { left: `${sliderPos}%`, transform: "translateX(-50%)" },
                children: /* @__PURE__ */ jsx("div", { className: "absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white ring-1 ring-black/[0.08]", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-0.5", children: [
                  /* @__PURE__ */ jsx("div", { className: "h-4 w-0.5 rounded bg-slate-400" }),
                  /* @__PURE__ */ jsx("div", { className: "h-4 w-0.5 rounded bg-slate-400" })
                ] }) })
              }
            )
          ]
        }
      ) })
    ] })
  ] });
}
export {
  BeforeAfterSlider as default
};

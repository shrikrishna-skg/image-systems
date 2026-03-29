import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Globe,
  Loader2,
  ArrowLeft,
  ScanSearch,
  ImageIcon,
  CheckSquare,
  Square,
  LayoutGrid,
  Rows3,
  ExternalLink,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  History,
  Trash2,
  Clock,
  Gauge,
  Info,
  KeyRound,
  Download
} from "lucide-react";
import { toast } from "sonner";
import {
  postScrapeImportUrlsBatch,
  scrapePageForImages,
  SCRAPE_IMPORT_URLS_CHUNK
} from "../api/scrape";
import { listKeys } from "../api/apiKeys";
import { isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import {
  MAX_WORKSPACE_ASSETS,
  remainingWorkspaceSlots,
  WORKSPACE_UI_SHOW_SLASH_TOTAL
} from "../lib/workspaceLimits";
import { useImageStore } from "../stores/imageStore";
import { toastProcessingError } from "../lib/processingToast";
import {
  defaultImageSizeFilter,
  isSizeFilterActive,
  PRESET_MAX_PIXELS_SMALL,
  PRESET_MIN_PIXELS_HERO,
  PRESET_MIN_PIXELS_WEB
} from "../lib/importUrlImageFilters";
import {
  countSizedScrapeThumbs,
  decodeUrlSearchParam,
  filterVisibleScrapedImages,
  formatThumbSizeLabel,
  isValidHttpUrl,
  pickLargestByThumbArea,
  pruneSelectionToVisibleUrls,
  sortScrapedImagesByPixelSize,
  stringSetsEqual,
  toImportPreviewUrl
} from "../lib/importUrlScanModel";
import {
  clearImportUrlHistory,
  loadImportUrlHistory,
  recordImportUrlScan,
  removeImportUrlHistoryEntry
} from "../lib/importUrlHistory";
import {
  defaultZipStemForScrapePage,
  downloadScannedImageUrls
} from "../lib/scrapeUrlDownload";
import { WORKSPACE_GRID_VIRTUAL_THRESHOLD } from "../lib/workspaceGridVirtual";
import VirtualizedWorkspaceThumbGrid from "../components/workspace/VirtualizedWorkspaceThumbGrid";
const storageOnly = isStorageOnlyMode();
function ExternalLinkButton({
  href,
  className,
  children,
  title
}) {
  return /* @__PURE__ */ jsx("a", { href, target: "_blank", rel: "noopener noreferrer", title, className, children });
}
function ImportFromUrlPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceMode = useImageStore((s) => s.workspaceMode);
  const sessionCount = useImageStore((s) => s.sessionImages.length);
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [finalUrl, setFinalUrl] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState(() => /* @__PURE__ */ new Set());
  const [thumbSize, setThumbSize] = useState("comfortable");
  const [useRenderedScrape, setUseRenderedScrape] = useState(true);
  const [hasUserZyteKey, setHasUserZyteKey] = useState(false);
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [useGroqNaming, setUseGroqNaming] = useState(true);
  const [scrapeImageCap, setScrapeImageCap] = useState(5e3);
  const [sizeFilter, setSizeFilter] = useState(() => defaultImageSizeFilter());
  const [sizeSort, setSizeSort] = useState("none");
  const [dimensionsByUrl, setDimensionsByUrl] = useState({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [hideUnsizedWhenFiltering, setHideUnsizedWhenFiltering] = useState(false);
  const [importSubView, setImportSubView] = useState("scan");
  const [historyEntries, setHistoryEntries] = useState(() => loadImportUrlHistory());
  const [scanElapsedSec, setScanElapsedSec] = useState(0);
  const [downloadingSelection, setDownloadingSelection] = useState(false);
  const urlPrefillApplied = useRef(false);
  useEffect(() => {
    if (urlPrefillApplied.current) return;
    const pre = searchParams.get("url");
    if (!pre) return;
    urlPrefillApplied.current = true;
    setUrl(decodeUrlSearchParam(pre));
  }, [searchParams]);
  const refreshHistory = useCallback(() => {
    setHistoryEntries(loadImportUrlHistory());
  }, []);
  const sizeFilterActive = useMemo(() => isSizeFilterActive(sizeFilter), [sizeFilter]);
  const visibleImages = useMemo(() => {
    const filtered = filterVisibleScrapedImages(
      images,
      dimensionsByUrl,
      sizeFilter,
      hideUnsizedWhenFiltering
    );
    return sortScrapedImagesByPixelSize(filtered, dimensionsByUrl, sizeSort);
  }, [images, dimensionsByUrl, sizeFilter, hideUnsizedWhenFiltering, sizeSort]);
  const sizedCount = useMemo(
    () => countSizedScrapeThumbs(images, dimensionsByUrl),
    [images, dimensionsByUrl]
  );
  const thumbSizePercent = useMemo(() => {
    if (images.length === 0) return 0;
    return Math.min(100, Math.round(sizedCount / images.length * 100));
  }, [images.length, sizedCount]);
  const slotsLeft = useMemo(() => {
    if (!workspaceMode) return 1;
    return remainingWorkspaceSlots(sessionCount);
  }, [workspaceMode, sessionCount]);
  const misconfigured = isPlaceholderApiBaseUrl();
  useEffect(() => {
    if (storageOnly || misconfigured) return;
    void listKeys().then((keys) => {
      setHasUserZyteKey(keys.some((k) => k.provider === "zyte"));
      const groq = keys.some((k) => k.provider === "groq");
      setHasGroqKey(groq);
      if (!groq) setUseGroqNaming(false);
    }).catch(() => {
      setHasUserZyteKey(false);
      setHasGroqKey(false);
      setUseGroqNaming(false);
    });
  }, [misconfigured]);
  useEffect(() => {
    if (importSubView === "history") refreshHistory();
  }, [importSubView, refreshHistory]);
  useEffect(() => {
    if (!scanning) {
      setScanElapsedSec(0);
      return;
    }
    setScanElapsedSec(0);
    const id = window.setInterval(() => {
      setScanElapsedSec((s) => s + 1);
    }, 1e3);
    return () => window.clearInterval(id);
  }, [scanning]);
  useEffect(() => {
    const vis = new Set(visibleImages.map((i) => i.url));
    setSelected((prev) => {
      const next = pruneSelectionToVisibleUrls(prev, vis);
      return stringSetsEqual(prev, next) ? prev : next;
    });
  }, [visibleImages]);
  const onThumbLoad = useCallback((imageUrl, el) => {
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    setDimensionsByUrl((prev) => ({ ...prev, [imageUrl]: { w, h } }));
  }, []);
  const onThumbError = useCallback((imageUrl) => {
    setDimensionsByUrl((prev) => ({ ...prev, [imageUrl]: "error" }));
  }, []);
  const toggleOne = useCallback((u) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });
  }, []);
  const selectAllVisible = useCallback(() => {
    setSelected(new Set(visibleImages.map((i) => i.url)));
  }, [visibleImages]);
  const clearSelection = useCallback(() => setSelected(/* @__PURE__ */ new Set()), []);
  const selectAllDiscovered = useCallback(() => {
    setSelected(new Set(images.map((i) => i.url)));
  }, [images]);
  const fillSlotsByResolution = useCallback(() => {
    const room = workspaceMode ? remainingWorkspaceSlots(useImageStore.getState().sessionImages.length) : 1;
    if (room <= 0) {
      toast.error("No free slots", {
        description: "Make room on Operations, or clear the workspace queue, then try again."
      });
      return;
    }
    if (visibleImages.length === 0) {
      toast.message("Nothing to select yet", {
        description: sizeFilterActive ? "Loosen filters or wait for thumbnails to finish sizing." : "Wait for thumbnails to appear, then try again."
      });
      return;
    }
    const pick = pickLargestByThumbArea(visibleImages, dimensionsByUrl, room);
    setSelected(new Set(pick.map((i) => i.url)));
    if (workspaceMode) {
      toast.success(`Selected ${pick.length} of your largest visible images (up to free slots)`, {
        description: "Import, then run batch enhancement on Operations \u2014 or open one photo to enhance it alone."
      });
    } else {
      toast.success("Selected the largest visible image for standard import", {
        description: "On Operations you enhance one photo at a time. Enable workspace batch to run many in parallel."
      });
    }
  }, [workspaceMode, visibleImages, sizeFilterActive, dimensionsByUrl]);
  const handleScan = async () => {
    if (storageOnly || misconfigured) return;
    const u = url.trim();
    if (!u) {
      toast.error("Paste a page URL first.");
      return;
    }
    setScanning(true);
    setImages([]);
    setFinalUrl(null);
    setTruncated(false);
    setSelected(/* @__PURE__ */ new Set());
    setDimensionsByUrl({});
    try {
      const res = await scrapePageForImages(u, { useRenderedScrape });
      setImages(res.images);
      setFinalUrl(res.final_url);
      setTruncated(res.truncated);
      setScrapeImageCap(res.scrape_image_cap ?? 5e4);
      recordImportUrlScan({
        inputUrl: u,
        finalUrl: res.final_url,
        imageCount: res.images.length,
        truncated: res.truncated
      });
      refreshHistory();
      if (res.images.length === 0) {
        toast.message("No images found", {
          description: useRenderedScrape ? "Try turning off Zyte for a plain fetch, add a Zyte key in Integrations for JavaScript-heavy pages, or open the page in a new tab." : "Try another URL, or turn on Zyte (Integrations) for JavaScript-heavy pages."
        });
      } else {
        toast.success(`Found ${res.images.length} image URL(s)`);
        setSelected(new Set(res.images.map((i) => i.url)));
      }
    } catch (err) {
      toastProcessingError(err, "Couldn\u2019t scan that page");
    } finally {
      setScanning(false);
    }
  };
  const scrapeImportNamingOpts = useCallback(
    (urlList) => ({
      useGroqNaming: useGroqNaming && hasGroqKey,
      pageUrl: finalUrl?.trim() || url.trim() || null,
      imageHints: urlList.map((u) => {
        const ref = images.find((i) => i.url === u);
        return { alt: ref?.alt ?? null, source: ref?.source ?? null };
      })
    }),
    [useGroqNaming, hasGroqKey, finalUrl, url, images]
  );
  const handleDownloadSelectedUrls = useCallback(async () => {
    if (misconfigured) return;
    const urls = images.filter((i) => selected.has(i.url)).map((i) => i.url);
    if (urls.length === 0) {
      toast.error("Select at least one image to download.");
      return;
    }
    setDownloadingSelection(true);
    try {
      const stem = defaultZipStemForScrapePage(finalUrl?.trim() || url.trim() || null);
      const res = await downloadScannedImageUrls(urls, { zipArchiveStem: stem });
      if (res.usedZip) {
        toast.success("ZIP download started", {
          description: res.failed > 0 ? `${res.saved} images in the archive \xB7 ${res.failed} could not be fetched (CORS or network).` : `${res.saved} images saved in one .zip file.`
        });
      } else {
        toast.success("Download started", {
          description: res.failed > 0 ? `1 file saved \xB7 ${res.failed} other selection(s) could not be fetched.` : "Saved the image file from its URL."
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed";
      toast.error("Could not download", { description: msg });
    } finally {
      setDownloadingSelection(false);
    }
  }, [misconfigured, images, selected, finalUrl, url]);
  const handleImport = async () => {
    if (storageOnly || misconfigured) return;
    const urls = images.filter((i) => selected.has(i.url)).map((i) => i.url);
    if (urls.length === 0) {
      toast.error("Select at least one image.");
      return;
    }
    let st = useImageStore.getState();
    if (urls.length > 1 && !st.workspaceMode) {
      st.setWorkspaceMode(true);
      toast.message("Workspace batch enabled", {
        description: "Multiple URL imports are saved to your workspace queue on Operations."
      });
      st = useImageStore.getState();
    }
    const inWorkspace = st.workspaceMode;
    const room = inWorkspace ? remainingWorkspaceSlots(st.sessionImages.length) : 1;
    const toImport = urls.slice(0, room);
    const overflow = urls.length - toImport.length;
    if (toImport.length === 0) {
      toast.error("Workspace full", {
        description: "Make room on Operations or clear the queue, then try again."
      });
      return;
    }
    if (overflow > 0) {
      toast.message("Workspace limit", {
        description: `Importing ${toImport.length.toLocaleString()} of ${urls.length.toLocaleString()} (${room.toLocaleString()} slot(s) left in this workspace).`
      });
    }
    const showProgress = toImport.length > SCRAPE_IMPORT_URLS_CHUNK;
    const progressId = "import-url-progress";
    setImporting(true);
    if (showProgress) {
      toast.loading(`Importing 0 / ${toImport.length.toLocaleString()} images\u2026`, {
        id: progressId,
        duration: Number.POSITIVE_INFINITY
      });
    }
    try {
      if (!inWorkspace) {
        const rows = await postScrapeImportUrlsBatch(toImport, scrapeImportNamingOpts(toImport));
        if (rows.length === 0) return;
        useImageStore.getState().setStandardImport(rows[0]);
        if (showProgress) toast.dismiss(progressId);
        toast.success("Photo ready", {
          description: "You\u2019re on Operations \u2014 tune settings and run the pipeline."
        });
        void navigate("/");
        return;
      }
      let totalAdded = 0;
      let droppedDueToCapacity = 0;
      let duplicatesSkipped = 0;
      for (let i = 0; i < toImport.length; i += SCRAPE_IMPORT_URLS_CHUNK) {
        const chunk = toImport.slice(i, i + SCRAPE_IMPORT_URLS_CHUNK);
        const rows = await postScrapeImportUrlsBatch(chunk, scrapeImportNamingOpts(chunk));
        const addResult = useImageStore.getState().addImagesToSession(rows);
        totalAdded += addResult.added;
        droppedDueToCapacity += addResult.droppedDueToCapacity;
        duplicatesSkipped += addResult.duplicatesSkipped;
        if (showProgress) {
          const done = Math.min(i + chunk.length, toImport.length);
          toast.loading(`Importing ${done.toLocaleString()} / ${toImport.length.toLocaleString()} images\u2026`, {
            id: progressId,
            duration: Number.POSITIVE_INFINITY
          });
        }
      }
      if (showProgress) toast.dismiss(progressId);
      if (totalAdded === 0) {
        toast.error("Nothing was added", {
          description: duplicatesSkipped ? "Those images may already be in the queue." : "Try again or pick different URLs."
        });
        return;
      }
      toast.success(totalAdded === 1 ? "1 photo added" : `${totalAdded.toLocaleString()} photos added`, {
        description: [
          overflow > 0 ? `${overflow.toLocaleString()} not imported (workspace room).` : null,
          droppedDueToCapacity > 0 ? `${droppedDueToCapacity} skipped (workspace filled during import).` : null
        ].filter(Boolean).join(" ") || void 0
      });
      void navigate("/");
    } catch (err) {
      if (showProgress) toast.dismiss(progressId);
      toastProcessingError(err, "Import failed");
      if (inWorkspace && useImageStore.getState().sessionImages.length > 0) {
        toast.message("Partial import", {
          description: "Some images were saved \u2014 open Operations to work with your queue."
        });
        void navigate("/");
      }
    } finally {
      setImporting(false);
    }
  };
  const gridMin = thumbSize === "comfortable" ? "minmax(6.5rem, 1fr)" : "minmax(4.75rem, 1fr)";
  const useVirtualImportGrid = visibleImages.length >= WORKSPACE_GRID_VIRTUAL_THRESHOLD;
  const renderImportThumb = useCallback(
    (img) => {
      const on = selected.has(img.url);
      const dim = dimensionsByUrl[img.url];
      const sizeLabel = formatThumbSizeLabel(dim);
      return /* @__PURE__ */ jsx("div", { className: "min-w-0", children: /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => toggleOne(img.url),
          className: `group w-full overflow-hidden rounded-xl border text-left shadow-sm transition-all ${on ? "border-black ring-2 ring-black ring-offset-2 ring-offset-white" : "border-neutral-200 hover:border-neutral-400 hover:shadow-md"}`,
          children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: `relative bg-neutral-100 ${thumbSize === "comfortable" ? "aspect-square" : "aspect-[4/3]"}`,
                children: [
                  /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: img.url,
                      alt: img.alt || "",
                      className: "h-full w-full object-cover",
                      loading: "lazy",
                      referrerPolicy: "no-referrer",
                      onLoad: (e) => onThumbLoad(img.url, e.currentTarget),
                      onError: () => {
                        onThumbError(img.url);
                      }
                    }
                  ),
                  /* @__PURE__ */ jsx("span", { className: "absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white", children: img.source }),
                  /* @__PURE__ */ jsx("span", { className: "absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 py-0.5 font-mono text-[9px] text-white", children: sizeLabel }),
                  on && /* @__PURE__ */ jsx("span", { className: "absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-md", children: /* @__PURE__ */ jsx(CheckSquare, { className: "h-3.5 w-3.5", strokeWidth: 2.5 }) })
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              "p",
              {
                className: `line-clamp-2 break-all px-2 py-1.5 font-mono text-neutral-500 ${thumbSize === "comfortable" ? "text-[10px]" : "text-[9px]"}`,
                children: img.url
              }
            )
          ]
        }
      ) });
    },
    [selected, dimensionsByUrl, thumbSize, toggleOne, onThumbLoad, onThumbError]
  );
  const importPrimaryLabel = workspaceMode ? selected.size > 1 ? `Import ${selected.size} selected (batch)` : "Import selected (batch)" : "Import to Operations";
  if (storageOnly) {
    return /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-2xl page-safe py-12", children: [
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/",
          className: "mb-8 inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-black",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back to Operations"
          ]
        }
      ),
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold text-black", children: "Import from URL" }),
      /* @__PURE__ */ jsx("p", { className: "mt-3 leading-relaxed text-neutral-600", children: "URL import needs the hosted API. This build runs in browser-only mode \u2014 use file upload on the home screen instead." })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-full min-w-0 flex-col bg-neutral-50", children: [
    /* @__PURE__ */ jsxs("header", { className: "sticky top-0 z-20 border-b border-neutral-200/90 bg-white/95 backdrop-blur-md", children: [
      /* @__PURE__ */ jsx("div", { className: "page-safe py-3", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex max-w-4xl flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ jsxs(
          Link,
          {
            to: "/",
            className: "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-black",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Operations" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-2 sm:gap-3", children: [
          /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-white", children: /* @__PURE__ */ jsx(Globe, { className: "h-4 w-4", strokeWidth: 2 }) }),
          /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx("h1", { className: "truncate text-base font-semibold tracking-tight text-black sm:text-lg", children: "Import from URL" }),
            /* @__PURE__ */ jsx("p", { className: "hidden text-xs text-neutral-500 sm:block", children: "Scan \xB7 history \xB7 max-throughput import \u2192 single or batch enhance" })
          ] })
        ] }),
        selected.size >= 1 ? /* @__PURE__ */ jsxs(
          Link,
          {
            to: "/",
            className: "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 sm:px-4 sm:text-sm",
            children: [
              /* @__PURE__ */ jsx(ImageIcon, { className: "h-3.5 w-3.5 sm:h-4 sm:w-4" }),
              "Enhance photos"
            ]
          }
        ) : /* @__PURE__ */ jsx("span", { className: "hidden max-w-[11rem] text-right text-[10px] leading-snug text-neutral-400 sm:block", children: "Select at least one image after scanning to continue to Operations." })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "border-t border-neutral-100 bg-white/90 page-safe", children: /* @__PURE__ */ jsxs(
        "nav",
        {
          className: "mx-auto flex max-w-4xl gap-1 py-2",
          "aria-label": "Import from URL sections",
          children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setImportSubView("scan"),
                className: `inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${importSubView === "scan" ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-black"}`,
                children: [
                  /* @__PURE__ */ jsx(ScanSearch, { className: "h-4 w-4 shrink-0 opacity-90", "aria-hidden": true }),
                  "Scan"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setImportSubView("history"),
                className: `inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${importSubView === "history" ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-black"}`,
                children: [
                  /* @__PURE__ */ jsx(History, { className: "h-4 w-4 shrink-0 opacity-90", "aria-hidden": true }),
                  "History",
                  historyEntries.length > 0 ? /* @__PURE__ */ jsx(
                    "span",
                    {
                      className: importSubView === "history" ? "rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-bold" : "rounded-full bg-neutral-200 px-1.5 py-0.5 text-[11px] font-bold text-neutral-700",
                      children: historyEntries.length
                    }
                  ) : null
                ]
              }
            )
          ]
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxs("main", { className: "mx-auto w-full max-w-4xl flex-1 page-safe py-5 pb-[max(6rem,env(safe-area-inset-bottom))] sm:py-6 sm:pb-10", children: [
      misconfigured && /* @__PURE__ */ jsxs("div", { className: "mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950", children: [
        "Set ",
        /* @__PURE__ */ jsx("code", { className: "font-mono text-xs", children: "VITE_API_BASE_URL" }),
        " so this app can reach your API."
      ] }),
      importSubView === "history" ? /* @__PURE__ */ jsxs("section", { className: "rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold text-black", children: "Scan history" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs leading-relaxed text-neutral-600", children: "URLs you have scanned on this device (stored in this browser only)." })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              disabled: historyEntries.length === 0,
              onClick: () => {
                if (historyEntries.length === 0) return;
                if (!window.confirm("Remove all saved import URLs from this browser?")) return;
                clearImportUrlHistory();
                refreshHistory();
              },
              className: "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40",
              children: [
                /* @__PURE__ */ jsx(Trash2, { className: "h-3.5 w-3.5", "aria-hidden": true }),
                "Clear all"
              ]
            }
          )
        ] }),
        historyEntries.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "py-14 text-center", children: [
          /* @__PURE__ */ jsx(Clock, { className: "mx-auto h-10 w-10 text-neutral-300", strokeWidth: 1.25, "aria-hidden": true }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm font-semibold text-black", children: "No URLs yet" }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-neutral-600", children: "Run a scan on the Scan tab \u2014 each successful scan is saved here for quick reuse." })
        ] }) : /* @__PURE__ */ jsx("ul", { className: "mt-4 space-y-3", children: historyEntries.map((entry) => {
          const finalTrim = entry.finalUrl.trim();
          const preview = toImportPreviewUrl(entry.inputUrl);
          const openHref = finalTrim && isValidHttpUrl(finalTrim) ? finalTrim : preview && isValidHttpUrl(preview) ? preview : null;
          let whenLabel = entry.scannedAt;
          try {
            whenLabel = new Date(entry.scannedAt).toLocaleString(void 0, {
              dateStyle: "medium",
              timeStyle: "short"
            });
          } catch {
          }
          return /* @__PURE__ */ jsxs(
            "li",
            {
              className: "rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 sm:p-4",
              children: [
                /* @__PURE__ */ jsx("p", { className: "break-all font-mono text-xs text-neutral-800 sm:text-sm", children: entry.inputUrl }),
                finalTrim && finalTrim !== entry.inputUrl.trim() ? /* @__PURE__ */ jsxs("p", { className: "mt-1 break-all font-mono text-[11px] text-neutral-500", children: [
                  "Resolved: ",
                  finalTrim
                ] }) : null,
                /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600", children: [
                  /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1", children: [
                    /* @__PURE__ */ jsx(Clock, { className: "h-3 w-3 shrink-0 opacity-70", "aria-hidden": true }),
                    whenLabel
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: "text-neutral-400", children: "\xB7" }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    entry.imageCount,
                    " image",
                    entry.imageCount === 1 ? "" : "s"
                  ] }),
                  entry.truncated ? /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx("span", { className: "text-neutral-400", children: "\xB7" }),
                    /* @__PURE__ */ jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900", children: "Truncated" })
                  ] }) : null
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => {
                        setUrl(entry.inputUrl);
                        setImportSubView("scan");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      },
                      className: "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50",
                      children: [
                        /* @__PURE__ */ jsx(ScanSearch, { className: "h-3.5 w-3.5", "aria-hidden": true }),
                        "Use URL"
                      ]
                    }
                  ),
                  openHref ? /* @__PURE__ */ jsxs(
                    ExternalLinkButton,
                    {
                      href: openHref,
                      className: "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50",
                      title: "Open page in a new tab",
                      children: [
                        /* @__PURE__ */ jsx(ExternalLink, { className: "h-3.5 w-3.5", "aria-hidden": true }),
                        "Open page"
                      ]
                    }
                  ) : null,
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      type: "button",
                      onClick: () => {
                        removeImportUrlHistoryEntry(entry.inputUrl);
                        refreshHistory();
                      },
                      className: "inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50",
                      children: [
                        /* @__PURE__ */ jsx(Trash2, { className: "h-3.5 w-3.5", "aria-hidden": true }),
                        "Remove"
                      ]
                    }
                  )
                ] })
              ]
            },
            entry.inputUrl
          );
        }) })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("section", { className: "rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5", children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-semibold uppercase tracking-wider text-neutral-500", children: "Page URL" }),
          /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "url",
                value: url,
                onChange: (e) => setUrl(e.target.value),
                placeholder: "https://yoursite.com/gallery",
                disabled: scanning || misconfigured,
                className: "min-h-[48px] flex-1 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 text-sm text-black placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50",
                onKeyDown: (e) => {
                  if (e.key === "Enter" && !e.shiftKey) void handleScan();
                }
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "flex shrink-0", children: /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => void handleScan(),
                disabled: scanning || misconfigured,
                className: "inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:w-auto sm:min-w-[9.5rem]",
                children: [
                  scanning ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx(ScanSearch, { className: "h-4 w-4" }),
                  scanning ? /* @__PURE__ */ jsxs("span", { className: "tabular-nums", children: [
                    "Scanning\u2026 ",
                    scanElapsedSec > 0 ? `${scanElapsedSec}s` : ""
                  ] }) : "Scan images"
                ]
              }
            ) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-3 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-3 sm:px-4", children: [
            /* @__PURE__ */ jsxs("label", { className: "flex cursor-pointer items-start gap-2.5 text-sm text-neutral-800", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  checked: useRenderedScrape,
                  onChange: (e) => setUseRenderedScrape(e.target.checked),
                  disabled: misconfigured,
                  className: "mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-black focus:ring-neutral-400"
                }
              ),
              /* @__PURE__ */ jsxs("span", { children: [
                /* @__PURE__ */ jsx("span", { className: "font-medium text-neutral-900", children: "Use enhanced scanning (Zyte)" }),
                /* @__PURE__ */ jsxs("span", { className: "mt-0.5 block text-xs text-neutral-600", children: [
                  "Renders the page like a real browser so we can find more images.",
                  " ",
                  /* @__PURE__ */ jsx(Link, { to: "/settings", className: "font-semibold text-sky-800 underline underline-offset-2 hover:text-sky-950", children: "Requires an API key \u2014 set up in Integrations." })
                ] })
              ] })
            ] }),
            !hasUserZyteKey && useRenderedScrape ? /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs text-amber-950", children: [
              /* @__PURE__ */ jsx(KeyRound, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-800", "aria-hidden": true }),
              /* @__PURE__ */ jsx("span", { children: "Zyte isn't configured yet \u2014 add your key in Integrations for the best results on JavaScript-heavy sites. Until then, we fall back to a simple fetch when possible." })
            ] }) : null,
            /* @__PURE__ */ jsxs("details", { className: "text-xs text-neutral-500", children: [
              /* @__PURE__ */ jsx("summary", { className: "cursor-pointer font-medium text-neutral-600 hover:text-black", children: "Learn how scanning uses Zyte" }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 leading-relaxed pl-1", children: "One browser job loads the page HTML; we discover image URLs from that document. Selecting and importing images does not run additional Zyte jobs for each file." })
            ] })
          ] }),
          finalUrl ? /* @__PURE__ */ jsxs("p", { className: "mt-3 text-[11px] leading-relaxed text-neutral-500", children: [
            /* @__PURE__ */ jsx("span", { className: "font-medium text-neutral-700", children: "Resolved:" }),
            " ",
            /* @__PURE__ */ jsx("span", { className: "break-all font-mono text-neutral-600", children: finalUrl }),
            truncated ? /* @__PURE__ */ jsxs("span", { className: "ml-2 text-amber-800", children: [
              "\xB7 first ",
              scrapeImageCap,
              " URLs listed (server cap)"
            ] }) : null
          ] }) : null
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 flex gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 sm:px-4", children: [
          /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600", children: /* @__PURE__ */ jsx(Info, { className: "h-4 w-4", strokeWidth: 2, "aria-hidden": true }) }),
          /* @__PURE__ */ jsxs("div", { className: "min-w-0 text-xs leading-relaxed text-neutral-700", children: [
            /* @__PURE__ */ jsx("p", { className: "font-semibold text-black", children: "Imports and Operations" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1", children: workspaceMode ? /* @__PURE__ */ jsxs(Fragment, { children: [
              "You're in ",
              /* @__PURE__ */ jsx("strong", { className: "text-neutral-900", children: "batch workspace" }),
              " on Operations: import up to your free slots, then run batch tools or open one photo to enhance individually",
              WORKSPACE_UI_SHOW_SLASH_TOTAL ? ` (up to ${MAX_WORKSPACE_ASSETS} assets per queue).` : "."
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              "You're in ",
              /* @__PURE__ */ jsx("strong", { className: "text-neutral-900", children: "single-photo" }),
              " mode: each import replaces your working image. Switch to ",
              /* @__PURE__ */ jsx("strong", { className: "text-neutral-900", children: "batch workspace" }),
              " on Operations to queue many URL imports at once."
            ] }) })
          ] })
        ] }),
        images.length > 0 ? /* @__PURE__ */ jsxs(
          "section",
          {
            className: "mt-4 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-white px-4 py-4 shadow-[0_1px_2px_rgba(91,33,182,0.06)] sm:px-5",
            "aria-labelledby": "import-max-output-heading",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start gap-3", children: [
                /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm", children: /* @__PURE__ */ jsx(Gauge, { className: "h-5 w-5", strokeWidth: 2, "aria-hidden": true }) }),
                /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ jsx("h2", { id: "import-max-output-heading", className: "text-sm font-semibold tracking-tight text-black", children: "Maximum output" }),
                  /* @__PURE__ */ jsxs("p", { className: "mt-1 text-xs leading-relaxed text-neutral-600", children: [
                    "Built for ",
                    /* @__PURE__ */ jsx("strong", { className: "text-neutral-800", children: "large page scans" }),
                    ": review counts and caps, select what you need, then import. Images are stored like uploads; on Operations you can run",
                    " ",
                    /* @__PURE__ */ jsx("strong", { className: "text-neutral-800", children: "batch pipelines" }),
                    " or open one photo for a",
                    " ",
                    /* @__PURE__ */ jsx("strong", { className: "text-neutral-800", children: "single" }),
                    " enhancement pass."
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap gap-2 border-t border-violet-100 pt-3", children: [
                /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center rounded-lg border border-violet-100 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-800", children: [
                  "Discovered",
                  " ",
                  /* @__PURE__ */ jsx("span", { className: "ml-1 font-mono tabular-nums text-violet-900", children: images.length }),
                  truncated ? /* @__PURE__ */ jsxs("span", { className: "ml-1.5 text-amber-800", children: [
                    "\xB7 cap ",
                    scrapeImageCap
                  ] }) : null
                ] }),
                visibleImages.length !== images.length || sizeFilterActive ? /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center rounded-lg border border-violet-100 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-800", children: [
                  "Visible now",
                  " ",
                  /* @__PURE__ */ jsx("span", { className: "ml-1 font-mono tabular-nums text-violet-900", children: visibleImages.length })
                ] }) : null,
                /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center rounded-lg border border-violet-100 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-800", children: [
                  "Selected",
                  " ",
                  /* @__PURE__ */ jsx("span", { className: "ml-1 font-mono tabular-nums text-violet-900", children: selected.size })
                ] }),
                /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center rounded-lg border border-violet-100 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-800", children: [
                  "Import budget",
                  " ",
                  /* @__PURE__ */ jsx("span", { className: "ml-1 font-mono tabular-nums text-violet-900", children: workspaceMode ? `${Math.min(selected.size, slotsLeft)} / ${slotsLeft} free` : "1 photo" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-neutral-200 bg-white/95 px-3 py-2.5 sm:items-center", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: useGroqNaming && hasGroqKey,
                    disabled: !hasGroqKey || misconfigured,
                    onChange: (e) => setUseGroqNaming(e.target.checked),
                    className: "mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-black focus:ring-neutral-400 sm:mt-0"
                  }
                ),
                /* @__PURE__ */ jsxs("span", { className: "min-w-0 text-xs leading-relaxed text-neutral-700", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-semibold text-neutral-900", children: "Name imports with Groq" }),
                  /* @__PURE__ */ jsxs("span", { className: "mt-0.5 block text-neutral-600", children: [
                    "Uses the same kebab-case rules as ",
                    /* @__PURE__ */ jsx("strong", { className: "text-neutral-800", children: "Gemini / OpenAI" }),
                    " export filename suggestions, so Deliverables and AI ZIP names stay consistent. One fast text call per image (page URL, link, alt text, size)."
                  ] }),
                  !hasGroqKey ? /* @__PURE__ */ jsxs("span", { className: "mt-1 block text-neutral-500", children: [
                    /* @__PURE__ */ jsx(Link, { to: "/settings", className: "font-semibold text-black underline decoration-neutral-300 underline-offset-2 hover:decoration-black", children: "Add a Groq API key in Integrations" }),
                    " ",
                    "(gsk_\u2026) to enable."
                  ] }) : null
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: selectAllDiscovered,
                    disabled: misconfigured || images.length === 0,
                    className: "inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-50 disabled:opacity-40",
                    children: [
                      /* @__PURE__ */ jsx(CheckSquare, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true }),
                      "All discovered"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: selectAllVisible,
                    disabled: misconfigured || visibleImages.length === 0,
                    className: "inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-50 disabled:opacity-40",
                    children: [
                      /* @__PURE__ */ jsx(LayoutGrid, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true }),
                      "Visible only"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: fillSlotsByResolution,
                    disabled: misconfigured,
                    className: "inline-flex items-center gap-1.5 rounded-lg border border-violet-600 bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-40",
                    children: [
                      /* @__PURE__ */ jsx(Sparkles, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true }),
                      workspaceMode ? "Fill free slots (largest first)" : "Pick best single (largest visible)"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => void handleDownloadSelectedUrls(),
                    disabled: misconfigured || selected.size === 0 || downloadingSelection,
                    className: "inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-50 disabled:opacity-40",
                    children: [
                      downloadingSelection ? /* @__PURE__ */ jsx(Loader2, { className: "h-3.5 w-3.5 shrink-0 animate-spin", "aria-hidden": true }) : /* @__PURE__ */ jsx(Download, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true }),
                      "Download selected",
                      selected.size > 1 ? " (ZIP)" : ""
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  Link,
                  {
                    to: "/",
                    className: "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50",
                    children: [
                      /* @__PURE__ */ jsx(ImageIcon, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true }),
                      "Operations: batch & single"
                    ]
                  }
                )
              ] })
            ]
          }
        ) : null,
        /* @__PURE__ */ jsx("section", { className: "mt-6 flex min-h-[min(52vh,28rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", children: images.length === 0 ? scanning ? /* @__PURE__ */ jsxs("div", { className: "flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center", children: [
          /* @__PURE__ */ jsx(Loader2, { className: "h-11 w-11 shrink-0 animate-spin text-violet-600", "aria-hidden": true }),
          /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md", children: [
            /* @__PURE__ */ jsx("p", { className: "text-base font-semibold text-black sm:text-lg", children: "Scanning page\u2026" }),
            /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sm leading-relaxed text-neutral-600", children: [
              "The server collects image URLs from the HTML (one request \u2014 there is no live count until it finishes).",
              useRenderedScrape ? " Zyte renders JavaScript; heavy travel sites often take 30\u201390 seconds." : " Large pages can still take a bit over plain HTTP."
            ] }),
            /* @__PURE__ */ jsxs(
              "p",
              {
                className: "mt-4 text-3xl font-semibold tabular-nums text-violet-900 font-data",
                "aria-live": "polite",
                children: [
                  scanElapsedSec,
                  "s"
                ]
              }
            ),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-neutral-500", children: "Elapsed time" }),
            /* @__PURE__ */ jsx("div", { className: "mt-5 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200", children: /* @__PURE__ */ jsx("div", { className: "import-url-scan-bar__shuttle h-full", role: "progressbar", "aria-label": "Scan in progress" }) }),
            /* @__PURE__ */ jsxs("p", { className: "mt-3 text-[11px] leading-relaxed text-neutral-500", children: [
              "When the run completes, you'll see how many URLs we found (up to",
              " ",
              scrapeImageCap.toLocaleString(),
              " per scan) and a percentage as thumbnails finish sizing in your browser."
            ] })
          ] })
        ] }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-1 flex-col items-center justify-center gap-5 px-6 py-14 text-center", children: [
          /* @__PURE__ */ jsxs("div", { className: "w-full max-w-sm rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/90 p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "mb-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500", children: "After you scan, images appear here" }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 gap-2", children: [1, 2, 3, 4, 5, 6].map((i) => /* @__PURE__ */ jsx(
              "div",
              {
                className: "aspect-square rounded-lg bg-gradient-to-br from-neutral-200 to-neutral-100 ring-1 ring-neutral-200/80"
              },
              i
            )) }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-[11px] text-neutral-500", children: "Thumbnail grid \u2014 tap to select, then import" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "max-w-md", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-black", children: "Nothing scanned yet" }),
            /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sm leading-relaxed text-neutral-600", children: [
              "Paste a page URL above and tap ",
              /* @__PURE__ */ jsx("strong", { className: "text-neutral-800", children: "Scan images" }),
              ". We list every photo we find so you can pick what to bring into Operations."
            ] })
          ] })
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { className: "sticky top-0 z-10 flex flex-col gap-2 border-b border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-5", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
              /* @__PURE__ */ jsxs("p", { className: "text-sm text-neutral-800", children: [
                /* @__PURE__ */ jsx("span", { className: "font-semibold text-black", children: selected.size }),
                /* @__PURE__ */ jsxs("span", { className: "text-neutral-500", children: [
                  " ",
                  "selected \xB7 ",
                  visibleImages.length,
                  " visible",
                  visibleImages.length !== images.length ? /* @__PURE__ */ jsxs("span", { className: "text-neutral-400", children: [
                    " (",
                    images.length,
                    " total)"
                  ] }) : null
                ] }),
                workspaceMode ? /* @__PURE__ */ jsxs("span", { className: "ml-2 text-xs text-neutral-500", children: [
                  "\xB7 ",
                  slotsLeft.toLocaleString(),
                  " free slot",
                  slotsLeft === 1 ? "" : "s",
                  WORKSPACE_UI_SHOW_SLASH_TOTAL ? ` (max ${MAX_WORKSPACE_ASSETS})` : ""
                ] }) : null
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-neutral-400 sm:inline", children: "Grid" }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setThumbSize("comfortable"),
                    className: `rounded-lg border p-2 transition-colors ${thumbSize === "comfortable" ? "border-black bg-neutral-100 text-black" : "border-neutral-200 text-neutral-500 hover:border-neutral-400"}`,
                    title: "Larger thumbnails",
                    "aria-pressed": thumbSize === "comfortable",
                    children: /* @__PURE__ */ jsx(LayoutGrid, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setThumbSize("compact"),
                    className: `rounded-lg border p-2 transition-colors ${thumbSize === "compact" ? "border-black bg-neutral-100 text-black" : "border-neutral-200 text-neutral-500 hover:border-neutral-400"}`,
                    title: "More columns",
                    "aria-pressed": thumbSize === "compact",
                    children: /* @__PURE__ */ jsx(Rows3, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: "mx-1 hidden h-4 w-px bg-neutral-200 sm:block", "aria-hidden": true }),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: selectAllVisible,
                    className: "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50",
                    children: [
                      /* @__PURE__ */ jsx(CheckSquare, { className: "h-3.5 w-3.5" }),
                      "All"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: clearSelection,
                    className: "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50",
                    children: [
                      /* @__PURE__ */ jsx(Square, { className: "h-3.5 w-3.5" }),
                      "None"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => void handleDownloadSelectedUrls(),
                    disabled: misconfigured || selected.size === 0 || downloadingSelection,
                    className: "inline-flex items-center gap-2 rounded-xl border-2 border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50 sm:text-sm",
                    children: [
                      downloadingSelection ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": true }) : /* @__PURE__ */ jsx(Download, { className: "h-4 w-4", "aria-hidden": true }),
                      /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Download" }),
                      /* @__PURE__ */ jsx("span", { className: "sm:hidden", children: "Save" }),
                      selected.size > 1 ? /* @__PURE__ */ jsx("span", { className: "font-data tabular-nums text-neutral-500", children: "\xB7 ZIP" }) : null
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => void handleImport(),
                    disabled: importing || selected.size === 0 || misconfigured,
                    className: "inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:text-sm",
                    children: [
                      importing ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx(ImageIcon, { className: "h-4 w-4" }),
                      importPrimaryLabel
                    ]
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "w-full min-w-0 border-t border-neutral-100 pt-2.5", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end justify-between gap-2 gap-y-1", children: [
                /* @__PURE__ */ jsxs("p", { className: "text-[11px] leading-snug text-neutral-700", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-data text-sm font-semibold tabular-nums text-black", children: images.length.toLocaleString() }),
                  " ",
                  /* @__PURE__ */ jsx("span", { className: "font-medium text-neutral-900", children: "image URLs" }),
                  truncated ? /* @__PURE__ */ jsxs("span", { className: "text-amber-800", children: [
                    " \xB7 list capped (server max ",
                    scrapeImageCap.toLocaleString(),
                    ")"
                  ] }) : null
                ] }),
                /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-medium text-neutral-600 font-data tabular-nums", "aria-live": "polite", children: [
                  "Preview load ",
                  thumbSizePercent,
                  "%",
                  " ",
                  /* @__PURE__ */ jsxs("span", { className: "text-neutral-500", children: [
                    "(",
                    sizedCount.toLocaleString(),
                    "/",
                    images.length.toLocaleString(),
                    " thumbs sized)"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: "mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200",
                  role: "progressbar",
                  "aria-valuenow": thumbSizePercent,
                  "aria-valuemin": 0,
                  "aria-valuemax": 100,
                  "aria-label": "Thumbnail preview load progress",
                  children: /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "h-full rounded-full bg-violet-600 transition-[width] duration-300 ease-out motion-reduce:transition-none",
                      style: { width: `${thumbSizePercent}%` }
                    }
                  )
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "border-b border-neutral-100 bg-neutral-50/90", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setFilterPanelOpen((o) => !o),
                className: "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left sm:px-5",
                children: [
                  /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-600", children: [
                    /* @__PURE__ */ jsx(SlidersHorizontal, { className: "h-4 w-4 text-neutral-500", "aria-hidden": true }),
                    "Filter and sort by size",
                    sizeFilterActive ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-amber-900", children: "Active" }) : null
                  ] }),
                  filterPanelOpen ? /* @__PURE__ */ jsx(ChevronUp, { className: "h-4 w-4 shrink-0 text-neutral-400", "aria-hidden": true }) : /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4 shrink-0 text-neutral-400", "aria-hidden": true })
                ]
              }
            ),
            filterPanelOpen ? /* @__PURE__ */ jsxs("div", { className: "space-y-3 px-4 pb-4 pt-0 sm:px-5", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] leading-relaxed text-neutral-600", children: "Size means total pixels (width \xD7 height) measured from each thumbnail as it loads in your browser, not file bytes on disk. Use presets or min/max megapixels to narrow the grid; sort puts largest or smallest first once a preview has loaded." }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      setSizeFilter(defaultImageSizeFilter());
                      setSizeSort("none");
                    },
                    className: "rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50",
                    children: "Reset filters and sort"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSizeFilter({
                      ...defaultImageSizeFilter(),
                      minPixels: PRESET_MIN_PIXELS_HERO
                    }),
                    className: "rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50",
                    children: "Large (\u2265 ~0.64 MP)"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSizeFilter({
                      ...defaultImageSizeFilter(),
                      minPixels: PRESET_MIN_PIXELS_WEB
                    }),
                    className: "rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50",
                    children: "Web photos (\u2265 ~0.16 MP)"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSizeFilter({
                      ...defaultImageSizeFilter(),
                      maxPixels: PRESET_MAX_PIXELS_SMALL
                    }),
                    className: "rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50",
                    children: "Small / icons (\u2264 ~0.04 MP)"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxs("label", { className: "block text-[10px] font-semibold uppercase tracking-wider text-neutral-500", children: [
                  "Minimum size (megapixels)",
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "number",
                      min: 0,
                      step: 0.01,
                      inputMode: "decimal",
                      value: sizeFilter.minPixels > 0 ? sizeFilter.minPixels / 1e6 : "",
                      onChange: (e) => {
                        const raw = e.target.value.trim();
                        setSizeFilter((p) => ({
                          ...p,
                          minPixels: raw === "" ? 0 : Math.max(0, Math.round((parseFloat(raw) || 0) * 1e6))
                        }));
                      },
                      className: "mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900",
                      placeholder: "Any"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("label", { className: "block text-[10px] font-semibold uppercase tracking-wider text-neutral-500", children: [
                  "Maximum size (megapixels)",
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "number",
                      min: 0,
                      step: 0.01,
                      inputMode: "decimal",
                      value: sizeFilter.maxPixels > 0 ? sizeFilter.maxPixels / 1e6 : "",
                      onChange: (e) => {
                        const raw = e.target.value.trim();
                        setSizeFilter((p) => ({
                          ...p,
                          maxPixels: raw === "" ? 0 : Math.max(0, Math.round((parseFloat(raw) || 0) * 1e6))
                        }));
                      },
                      className: "mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900",
                      placeholder: "Any"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("label", { className: "block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 sm:col-span-2", children: [
                  "Sort by pixel size",
                  /* @__PURE__ */ jsxs(
                    "select",
                    {
                      value: sizeSort,
                      onChange: (e) => setSizeSort(e.target.value),
                      className: "mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 sm:max-w-md",
                      children: [
                        /* @__PURE__ */ jsx("option", { value: "none", children: "Original scan order" }),
                        /* @__PURE__ */ jsx("option", { value: "desc", children: "Largest first (descending)" }),
                        /* @__PURE__ */ jsx("option", { value: "asc", children: "Smallest first (ascending)" })
                      ]
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "flex cursor-pointer items-start gap-2 text-xs text-neutral-700", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: hideUnsizedWhenFiltering,
                    onChange: (e) => setHideUnsizedWhenFiltering(e.target.checked),
                    disabled: !sizeFilterActive,
                    className: "mt-0.5 h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400 disabled:opacity-40"
                  }
                ),
                /* @__PURE__ */ jsxs("span", { children: [
                  /* @__PURE__ */ jsx("span", { className: "font-medium text-neutral-900", children: "Hide not-yet-sized" }),
                  " when a size filter is on (grid stays sparse until thumbnails finish loading)."
                ] })
              ] })
            ] }) : null
          ] }),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: `min-h-0 flex-1 px-3 pb-8 pt-4 sm:px-5 ${useVirtualImportGrid ? "flex flex-col overflow-hidden" : "overflow-y-auto overscroll-contain"}`,
              children: visibleImages.length === 0 && images.length > 0 ? /* @__PURE__ */ jsxs("p", { className: "py-12 text-center text-sm text-neutral-600", children: [
                "No images match these filters. Loosen min/max megapixels or reset \u2014 ",
                sizedCount,
                " of ",
                images.length,
                " ",
                "previews have a measured size so far."
              ] }) : useVirtualImportGrid ? /* @__PURE__ */ jsx(
                VirtualizedWorkspaceThumbGrid,
                {
                  items: visibleImages,
                  getId: (i) => i.url,
                  isFullscreen: false,
                  scrollClassName: "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                  renderCell: renderImportThumb,
                  captionEstimatePx: thumbSize === "comfortable" ? 44 : 38,
                  thumbAspect: thumbSize === "comfortable" ? "square" : "fourThree"
                }
              ) : /* @__PURE__ */ jsx(
                "ul",
                {
                  className: "grid gap-2 sm:gap-3",
                  style: {
                    gridTemplateColumns: `repeat(auto-fill, ${gridMin})`
                  },
                  children: visibleImages.map((img) => {
                    const on = selected.has(img.url);
                    const dim = dimensionsByUrl[img.url];
                    const sizeLabel = formatThumbSizeLabel(dim);
                    return /* @__PURE__ */ jsx("li", { className: "min-w-0", children: /* @__PURE__ */ jsxs(
                      "button",
                      {
                        type: "button",
                        onClick: () => toggleOne(img.url),
                        className: `group w-full overflow-hidden rounded-xl border text-left shadow-sm transition-all ${on ? "border-black ring-2 ring-black ring-offset-2 ring-offset-white" : "border-neutral-200 hover:border-neutral-400 hover:shadow-md"}`,
                        children: [
                          /* @__PURE__ */ jsxs(
                            "div",
                            {
                              className: `relative bg-neutral-100 ${thumbSize === "comfortable" ? "aspect-square" : "aspect-[4/3]"}`,
                              children: [
                                /* @__PURE__ */ jsx(
                                  "img",
                                  {
                                    src: img.url,
                                    alt: img.alt || "",
                                    className: "h-full w-full object-cover",
                                    loading: "lazy",
                                    referrerPolicy: "no-referrer",
                                    onLoad: (e) => onThumbLoad(img.url, e.currentTarget),
                                    onError: () => {
                                      onThumbError(img.url);
                                    }
                                  }
                                ),
                                /* @__PURE__ */ jsx("span", { className: "absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white", children: img.source }),
                                /* @__PURE__ */ jsx("span", { className: "absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 py-0.5 font-mono text-[9px] text-white", children: sizeLabel }),
                                on && /* @__PURE__ */ jsx("span", { className: "absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-md", children: /* @__PURE__ */ jsx(CheckSquare, { className: "h-3.5 w-3.5", strokeWidth: 2.5 }) })
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            "p",
                            {
                              className: `line-clamp-2 break-all px-2 py-1.5 font-mono text-neutral-500 ${thumbSize === "comfortable" ? "text-[10px]" : "text-[9px]"}`,
                              children: img.url
                            }
                          )
                        ]
                      }
                    ) }, img.url);
                  })
                }
              )
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxs("span", { className: "text-xs text-neutral-600", children: [
              /* @__PURE__ */ jsx("strong", { className: "text-black", children: selected.size }),
              " selected",
              selected.size > 1 ? /* @__PURE__ */ jsx("span", { className: "text-neutral-400", children: " \xB7 multi-save uses one ZIP" }) : null
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => void handleDownloadSelectedUrls(),
                  disabled: misconfigured || selected.size === 0 || downloadingSelection,
                  className: "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800 disabled:opacity-50",
                  children: [
                    downloadingSelection ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx(Download, { className: "h-4 w-4" }),
                    selected.size > 1 ? "ZIP" : "Save"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => void handleImport(),
                  disabled: importing || selected.size === 0 || misconfigured,
                  className: "inline-flex min-h-[44px] flex-[1.35] items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-50",
                  children: [
                    importing ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : null,
                    importPrimaryLabel
                  ]
                }
              )
            ] })
          ] }) })
        ] }) }),
        /* @__PURE__ */ jsxs("footer", { className: "mt-6 text-[11px] leading-relaxed text-neutral-500", children: [
          "You need rights to use imported images. ",
          /* @__PURE__ */ jsx("strong", { className: "text-neutral-600", children: "Download selected" }),
          " pulls files in your browser (one image = single file; two or more = one ZIP). Some hosts block cross-origin downloads even when previews work \u2014 import to Operations and use",
          " ",
          /* @__PURE__ */ jsx("strong", { className: "text-neutral-600", children: "Export & download" }),
          " there if needed. The API blocks private-network URLs. Discovery runs on the server (Zyte when configured, otherwise plain fetch). After import, Operations supports ",
          /* @__PURE__ */ jsx("strong", { className: "text-neutral-600", children: "batch" }),
          " jobs across the queue and",
          " ",
          /* @__PURE__ */ jsx("strong", { className: "text-neutral-600", children: "single" }),
          "-image runs. Keys:",
          " ",
          /* @__PURE__ */ jsx(Link, { to: "/settings", className: "font-medium text-neutral-700 underline underline-offset-2 hover:text-black", children: "Integrations" }),
          "."
        ] })
      ] })
    ] })
  ] });
}
export {
  ImportFromUrlPage as default
};

import { useState, useCallback, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  postScrapeImportUrlsBatch,
  scrapePageForImages,
  SCRAPE_IMPORT_URLS_CHUNK,
  type ScrapedImageRef,
} from "../api/scrape";
import { listKeys } from "../api/apiKeys";
import { isPlaceholderApiBaseUrl } from "../lib/apiBase";
import { isStorageOnlyMode } from "../lib/storageOnlyMode";
import {
  MAX_WORKSPACE_ASSETS,
  remainingWorkspaceSlots,
  WORKSPACE_UI_SHOW_SLASH_TOTAL,
} from "../lib/workspaceLimits";
import { useImageStore } from "../stores/imageStore";
import { toastProcessingError } from "../lib/processingToast";
import { isElectronShell, openExternalUrl } from "../lib/openExternalUrl";
import {
  defaultImageDimFilter,
  imagePassesDimFilter,
  isDimFilterActive,
  type ImageDimFilter,
} from "../lib/importUrlImageFilters";
import {
  clearImportUrlHistory,
  loadImportUrlHistory,
  recordImportUrlScan,
  removeImportUrlHistoryEntry,
  type ImportUrlHistoryEntry,
} from "../lib/importUrlHistory";

const storageOnly = isStorageOnlyMode();

function ExternalLinkButton({
  href,
  className,
  children,
  title,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  title?: string;
}) {
  if (isElectronShell()) {
    return (
      <button type="button" title={title} className={className} onClick={() => void openExternalUrl(href)}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={className}>
      {children}
    </a>
  );
}

function toPreviewUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isValidHttpUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ImportFromUrlPage() {
  const navigate = useNavigate();
  const workspaceMode = useImageStore((s) => s.workspaceMode);
  const sessionCount = useImageStore((s) => s.sessionImages.length);

  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [images, setImages] = useState<ScrapedImageRef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [thumbSize, setThumbSize] = useState<"comfortable" | "compact">("comfortable");
  const [useRenderedScrape, setUseRenderedScrape] = useState(true);
  const [hasUserZyteKey, setHasUserZyteKey] = useState(false);
  const [scrapeImageCap, setScrapeImageCap] = useState(5000);
  const [dimFilter, setDimFilter] = useState<ImageDimFilter>(() => defaultImageDimFilter());
  const [dimensionsByUrl, setDimensionsByUrl] = useState<
    Record<string, { w: number; h: number } | "error">
  >({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [hideUnsizedWhenFiltering, setHideUnsizedWhenFiltering] = useState(false);
  const [importSubView, setImportSubView] = useState<"scan" | "history">("scan");
  const [historyEntries, setHistoryEntries] = useState<ImportUrlHistoryEntry[]>(() => loadImportUrlHistory());

  const refreshHistory = useCallback(() => {
    setHistoryEntries(loadImportUrlHistory());
  }, []);

  const browserTargetUrl = useMemo(() => finalUrl ?? toPreviewUrl(url), [finalUrl, url]);

  const dimFilterActive = useMemo(() => isDimFilterActive(dimFilter), [dimFilter]);

  const visibleImages = useMemo(() => {
    return images.filter((img) => {
      const meta = dimensionsByUrl[img.url];
      if (meta === "error") return false;
      if (meta === undefined) {
        if (!dimFilterActive) return true;
        return !hideUnsizedWhenFiltering;
      }
      return imagePassesDimFilter(meta.w, meta.h, dimFilter);
    });
  }, [images, dimensionsByUrl, dimFilter, dimFilterActive, hideUnsizedWhenFiltering]);

  const sizedCount = useMemo(() => {
    return images.filter((i) => {
      const m = dimensionsByUrl[i.url];
      return m !== undefined && m !== "error";
    }).length;
  }, [images, dimensionsByUrl]);

  const openInTabHref = useMemo(() => {
    const u = browserTargetUrl;
    if (!u || !isValidHttpUrl(u)) return null;
    return u;
  }, [browserTargetUrl]);

  const slotsLeft = useMemo(() => {
    if (!workspaceMode) return 1;
    return remainingWorkspaceSlots(sessionCount);
  }, [workspaceMode, sessionCount]);

  const misconfigured = isPlaceholderApiBaseUrl();

  useEffect(() => {
    if (storageOnly || misconfigured) return;
    void listKeys()
      .then((keys) => {
        setHasUserZyteKey(keys.some((k) => k.provider === "zyte"));
      })
      .catch(() => {
        setHasUserZyteKey(false);
      });
  }, [misconfigured]);

  useEffect(() => {
    if (importSubView === "history") refreshHistory();
  }, [importSubView, refreshHistory]);

  useEffect(() => {
    const vis = new Set(visibleImages.map((i) => i.url));
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((u) => {
        if (vis.has(u)) next.add(u);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [visibleImages]);

  const onThumbLoad = useCallback((imageUrl: string, el: HTMLImageElement) => {
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    setDimensionsByUrl((prev) => ({ ...prev, [imageUrl]: { w, h } }));
  }, []);

  const onThumbError = useCallback((imageUrl: string) => {
    setDimensionsByUrl((prev) => ({ ...prev, [imageUrl]: "error" }));
  }, []);

  const toggleOne = useCallback((u: string) => {
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

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const pixelAreaForUrl = useCallback(
    (imageUrl: string): number => {
      const m = dimensionsByUrl[imageUrl];
      if (!m || m === "error") return 0;
      return m.w * m.h;
    },
    [dimensionsByUrl],
  );

  const selectAllDiscovered = useCallback(() => {
    setSelected(new Set(images.map((i) => i.url)));
  }, [images]);

  const fillSlotsByResolution = useCallback(() => {
    const room = workspaceMode ? remainingWorkspaceSlots(useImageStore.getState().sessionImages.length) : 1;
    if (room <= 0) {
      toast.error("No free slots", {
        description: "Make room on Operations, or clear the workspace queue, then try again.",
        duration: 5000,
      });
      return;
    }
    if (visibleImages.length === 0) {
      toast.message("Nothing to select yet", {
        description: dimFilterActive
          ? "Loosen filters or wait for thumbnails to load dimensions."
          : "Wait for thumbnails to appear, then try again.",
        duration: 5000,
      });
      return;
    }
    const ranked = [...visibleImages].sort((a, b) => pixelAreaForUrl(b.url) - pixelAreaForUrl(a.url));
    const pick = ranked.slice(0, room);
    setSelected(new Set(pick.map((i) => i.url)));
    if (workspaceMode) {
      toast.success(`Selected ${pick.length} of your largest visible images (up to free slots)`, {
        description: "Import, then run batch enhancement on Operations — or open one photo to enhance it alone.",
        duration: 5500,
      });
    } else {
      toast.success("Selected the largest visible image for standard import", {
        description: "On Operations you enhance one photo at a time. Enable workspace batch to run many in parallel.",
        duration: 5500,
      });
    }
  }, [workspaceMode, visibleImages, dimFilterActive, pixelAreaForUrl]);

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
    setSelected(new Set());
    setDimensionsByUrl({});
    try {
      const res = await scrapePageForImages(u, { useRenderedScrape });
      setImages(res.images);
      setFinalUrl(res.final_url);
      setTruncated(res.truncated);
      setScrapeImageCap(res.scrape_image_cap ?? 50_000);
      recordImportUrlScan({
        inputUrl: u,
        finalUrl: res.final_url,
        imageCount: res.images.length,
        truncated: res.truncated,
      });
      refreshHistory();
      if (res.images.length === 0) {
        toast.message("No images found", {
          description: useRenderedScrape
            ? "Try turning off Zyte for a plain fetch, add a Zyte key in Integrations for JavaScript-heavy pages, or open the page in a new tab."
            : "Try another URL, or turn on Zyte (Integrations) for JavaScript-heavy pages.",
          duration: 6500,
        });
      } else {
        toast.success(`Found ${res.images.length} image URL(s)`);
        setSelected(new Set(res.images.map((i) => i.url)));
      }
    } catch (err: unknown) {
      toastProcessingError(err, "Couldn’t scan that page");
    } finally {
      setScanning(false);
    }
  };

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
        description: "Multiple URL imports are saved to your workspace queue on Operations.",
        duration: 4500,
      });
      st = useImageStore.getState();
    }

    const inWorkspace = st.workspaceMode;
    const room = inWorkspace ? remainingWorkspaceSlots(st.sessionImages.length) : 1;
    const toImport = urls.slice(0, room);
    const overflow = urls.length - toImport.length;

    if (toImport.length === 0) {
      toast.error("Workspace full", {
        description: "Make room on Operations or clear the queue, then try again.",
        duration: 5000,
      });
      return;
    }

    if (overflow > 0) {
      toast.message("Workspace limit", {
        description: `Importing ${toImport.length.toLocaleString()} of ${urls.length.toLocaleString()} (${room.toLocaleString()} slot(s) left in this workspace).`,
        duration: 6000,
      });
    }

    const showProgress = toImport.length > SCRAPE_IMPORT_URLS_CHUNK;
    const progressId = "import-url-progress";

    setImporting(true);
    if (showProgress) {
      toast.loading(`Importing 0 / ${toImport.length.toLocaleString()} images…`, { id: progressId });
    }

    try {
      if (!inWorkspace) {
        const rows = await postScrapeImportUrlsBatch(toImport);
        if (rows.length === 0) return;
        useImageStore.getState().setStandardImport(rows[0]);
        if (showProgress) toast.dismiss(progressId);
        toast.success("Photo ready", {
          description: "You’re on Operations — tune settings and run the pipeline.",
          duration: 4000,
        });
        void navigate("/");
        return;
      }

      let totalAdded = 0;
      let droppedDueToCapacity = 0;
      let duplicatesSkipped = 0;

      for (let i = 0; i < toImport.length; i += SCRAPE_IMPORT_URLS_CHUNK) {
        const chunk = toImport.slice(i, i + SCRAPE_IMPORT_URLS_CHUNK);
        const rows = await postScrapeImportUrlsBatch(chunk);
        const addResult = useImageStore.getState().addImagesToSession(rows);
        totalAdded += addResult.added;
        droppedDueToCapacity += addResult.droppedDueToCapacity;
        duplicatesSkipped += addResult.duplicatesSkipped;
        if (showProgress) {
          const done = Math.min(i + chunk.length, toImport.length);
          toast.loading(`Importing ${done.toLocaleString()} / ${toImport.length.toLocaleString()} images…`, {
            id: progressId,
          });
        }
      }

      if (showProgress) toast.dismiss(progressId);

      if (totalAdded === 0) {
        toast.error("Nothing was added", {
          description: duplicatesSkipped
            ? "Those images may already be in the queue."
            : "Try again or pick different URLs.",
        });
        return;
      }

      toast.success(totalAdded === 1 ? "1 photo added" : `${totalAdded.toLocaleString()} photos added`, {
        description:
          [
            overflow > 0 ? `${overflow.toLocaleString()} not imported (workspace room).` : null,
            droppedDueToCapacity > 0
              ? `${droppedDueToCapacity} skipped (workspace filled during import).`
              : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
        duration: 5500,
      });
      void navigate("/");
    } catch (err: unknown) {
      if (showProgress) toast.dismiss(progressId);
      toastProcessingError(err, "Import failed");
      if (inWorkspace && useImageStore.getState().sessionImages.length > 0) {
        toast.message("Partial import", {
          description: "Some images were saved — open Operations to work with your queue.",
          duration: 5000,
        });
        void navigate("/");
      }
    } finally {
      setImporting(false);
    }
  };

  const gridMin = thumbSize === "comfortable" ? "minmax(6.5rem, 1fr)" : "minmax(4.75rem, 1fr)";

  const importPrimaryLabel = workspaceMode
    ? selected.size > 1
      ? `Import ${selected.size} selected (batch)`
      : "Import selected (batch)"
    : "Import to Operations";

  if (storageOnly) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Operations
        </Link>
        <h1 className="text-2xl font-semibold text-black">Import from URL</h1>
        <p className="mt-3 leading-relaxed text-neutral-600">
          URL import needs the hosted API. This build runs in browser-only mode — use file upload on the home screen
          instead.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full min-w-0 flex-col bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200/90 bg-white/95 backdrop-blur-md">
        <div className="px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-black"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Operations</span>
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-white">
                <Globe className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-black sm:text-lg">Import from URL</h1>
                <p className="hidden text-xs text-neutral-500 sm:block">
                  Scan · history · max-throughput import → single or batch enhance
                </p>
              </div>
            </div>
            <Link
              to="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 sm:px-4 sm:text-sm"
            >
              <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Enhance photos
            </Link>
          </div>
        </div>
        <div className="border-t border-neutral-100 bg-white/90 px-4 sm:px-6">
          <nav
            className="mx-auto flex max-w-4xl gap-1 py-2"
            aria-label="Import from URL sections"
          >
            <button
              type="button"
              onClick={() => setImportSubView("scan")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                importSubView === "scan"
                  ? "bg-black text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-black"
              }`}
            >
              <ScanSearch className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Scan
            </button>
            <button
              type="button"
              onClick={() => setImportSubView("history")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                importSubView === "history"
                  ? "bg-black text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-black"
              }`}
            >
              <History className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              History
              {historyEntries.length > 0 ? (
                <span
                  className={
                    importSubView === "history"
                      ? "rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-bold"
                      : "rounded-full bg-neutral-200 px-1.5 py-0.5 text-[11px] font-bold text-neutral-700"
                  }
                >
                  {historyEntries.length}
                </span>
              ) : null}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-6 sm:pb-10">
        {misconfigured && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Set <code className="font-mono text-xs">VITE_API_BASE_URL</code> so this app can reach your API.
          </div>
        )}

        {importSubView === "history" ? (
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-black">Scan history</h2>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                  URLs you have scanned on this device (stored in this browser only).
                </p>
              </div>
              <button
                type="button"
                disabled={historyEntries.length === 0}
                onClick={() => {
                  if (historyEntries.length === 0) return;
                  if (!window.confirm("Remove all saved import URLs from this browser?")) return;
                  clearImportUrlHistory();
                  refreshHistory();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Clear all
              </button>
            </div>

            {historyEntries.length === 0 ? (
              <div className="py-14 text-center">
                <Clock className="mx-auto h-10 w-10 text-neutral-300" strokeWidth={1.25} aria-hidden />
                <p className="mt-4 text-sm font-semibold text-black">No URLs yet</p>
                <p className="mt-2 text-sm text-neutral-600">
                  Run a scan on the Scan tab — each successful scan is saved here for quick reuse.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {historyEntries.map((entry) => {
                  const finalTrim = entry.finalUrl.trim();
                  const preview = toPreviewUrl(entry.inputUrl);
                  const openHref =
                    finalTrim && isValidHttpUrl(finalTrim)
                      ? finalTrim
                      : preview && isValidHttpUrl(preview)
                        ? preview
                        : null;
                  let whenLabel = entry.scannedAt;
                  try {
                    whenLabel = new Date(entry.scannedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    });
                  } catch {
                    /* keep ISO string */
                  }
                  return (
                    <li
                      key={entry.inputUrl}
                      className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 sm:p-4"
                    >
                      <p className="break-all font-mono text-xs text-neutral-800 sm:text-sm">{entry.inputUrl}</p>
                      {finalTrim && finalTrim !== entry.inputUrl.trim() ? (
                        <p className="mt-1 break-all font-mono text-[11px] text-neutral-500">Resolved: {finalTrim}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                          {whenLabel}
                        </span>
                        <span className="text-neutral-400">·</span>
                        <span>
                          {entry.imageCount} image{entry.imageCount === 1 ? "" : "s"}
                        </span>
                        {entry.truncated ? (
                          <>
                            <span className="text-neutral-400">·</span>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              Truncated
                            </span>
                          </>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setUrl(entry.inputUrl);
                            setImportSubView("scan");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                        >
                          <ScanSearch className="h-3.5 w-3.5" aria-hidden />
                          Use URL
                        </button>
                        {openHref ? (
                          <ExternalLinkButton
                            href={openHref}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                            title="Open page in a new tab"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            Open page
                          </ExternalLinkButton>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            removeImportUrlHistoryEntry(entry.inputUrl);
                            refreshHistory();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <>
        <section className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">Page URL</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yoursite.com/gallery"
              disabled={scanning || misconfigured}
              className="min-h-[48px] flex-1 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 text-sm text-black placeholder:text-neutral-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) void handleScan();
              }}
            />
            <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0">
              {openInTabHref && !misconfigured ? (
                <ExternalLinkButton
                  href={openInTabHref}
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 hover:border-black hover:bg-neutral-50 sm:flex-initial sm:min-w-[10.5rem]"
                >
                  <ExternalLink className="h-4 w-4" />
                  {isElectronShell() ? "Open separately" : "Open in new tab"}
                </ExternalLinkButton>
              ) : (
                <span className="inline-flex min-h-[48px] flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl border-2 border-neutral-100 bg-neutral-50 px-4 text-sm font-semibold text-neutral-400 sm:flex-initial sm:min-w-[10.5rem]">
                  <ExternalLink className="h-4 w-4" />
                  Open in new tab
                </span>
              )}
              <button
                type="button"
                onClick={() => void handleScan()}
                disabled={scanning || misconfigured}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:flex-initial sm:min-w-[9.5rem]"
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                Scan images
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-800 sm:items-center">
              <input
                type="checkbox"
                checked={useRenderedScrape}
                onChange={(e) => setUseRenderedScrape(e.target.checked)}
                disabled={misconfigured}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-black focus:ring-neutral-400 sm:mt-0"
              />
              <span>
                <span className="inline-flex items-center gap-1.5 font-medium text-neutral-900">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                  Use Zyte (browser HTML)
                </span>
                <span className="mt-0.5 block text-xs font-normal text-neutral-600">
                  When enabled and a key is available, the server uses <strong className="text-neutral-800">Zyte</strong>{" "}
                  for the page HTML; otherwise it uses plain HTTP. Keys or server env in Integrations / deployment.
                </span>
              </span>
            </label>
            <div className="shrink-0 space-y-1 pl-7 sm:pl-0 sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Integrations</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span className={hasUserZyteKey ? "font-semibold text-emerald-800" : "text-neutral-500"}>
                  Zyte {hasUserZyteKey ? "· saved" : "· not set"}
                </span>
              </div>
              <Link
                to="/settings"
                className="inline-block text-xs font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900"
              >
                Manage keys →
              </Link>
            </div>
          </div>

          <p className="mt-2 border-t border-neutral-100 pt-2 text-[10px] leading-relaxed text-neutral-500">
            <strong className="text-neutral-700">One browser job per scan:</strong> when Zyte runs, it fetches the page
            once; the server parses all discoverable image URLs from that HTML. Filters, selection, and Import only
            request the image files themselves — <strong className="text-neutral-700">no extra Zyte usage</strong>.
          </p>

          {finalUrl ? (
            <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
              <span className="font-medium text-neutral-700">Resolved:</span>{" "}
              <span className="break-all font-mono text-neutral-600">{finalUrl}</span>
              {truncated ? (
                <span className="ml-2 text-amber-800">· first {scrapeImageCap} URLs listed (server cap)</span>
              ) : null}
            </p>
          ) : null}
        </section>

        {workspaceMode ? (
          <div className="mt-4 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-950">
            <strong className="font-semibold">Workspace batch:</strong> import up to your free slots, then on
            Operations use <strong className="font-semibold">batch / Run all</strong> to enhance many photos in
            parallel, or open one thumbnail to tweak and run a <strong className="font-semibold">single</strong> job
            {WORKSPACE_UI_SHOW_SLASH_TOTAL ? ` (${MAX_WORKSPACE_ASSETS} assets max).` : " (large queues supported)."}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2.5 text-xs text-sky-950">
            <strong className="font-semibold">Standard mode:</strong> one import at a time — ideal for a single
            enhancement run. Turn on <strong className="font-semibold">Workspace batch</strong> on Operations to
            import and improve many URL images in one pass.
          </div>
        )}

        {images.length > 0 ? (
          <section
            className="mt-4 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-white px-4 py-4 shadow-[0_1px_2px_rgba(91,33,182,0.06)] sm:px-5"
            aria-labelledby="import-max-output-heading"
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                <Gauge className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="import-max-output-heading" className="text-sm font-semibold tracking-tight text-black">
                  Maximum output
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                  Built for <strong className="text-neutral-800">large page scans</strong>: review counts and caps,
                  select what you need, then import. Images are stored like uploads; on Operations you can run{" "}
                  <strong className="text-neutral-800">batch pipelines</strong> or open one photo for a{" "}
                  <strong className="text-neutral-800">single</strong> enhancement pass.
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-violet-100 pt-3">
              <span className="inline-flex items-center rounded-lg border border-violet-100 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-800">
                Discovered{" "}
                <span className="ml-1 font-mono tabular-nums text-violet-900">{images.length}</span>
                {truncated ? (
                  <span className="ml-1.5 text-amber-800">· cap {scrapeImageCap}</span>
                ) : null}
              </span>
              {visibleImages.length !== images.length || dimFilterActive ? (
                <span className="inline-flex items-center rounded-lg border border-violet-100 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-800">
                  Visible now{" "}
                  <span className="ml-1 font-mono tabular-nums text-violet-900">{visibleImages.length}</span>
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-lg border border-violet-100 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-800">
                Selected{" "}
                <span className="ml-1 font-mono tabular-nums text-violet-900">{selected.size}</span>
              </span>
              <span className="inline-flex items-center rounded-lg border border-violet-100 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-800">
                Import budget{" "}
                <span className="ml-1 font-mono tabular-nums text-violet-900">
                  {workspaceMode ? `${Math.min(selected.size, slotsLeft)} / ${slotsLeft} free` : "1 photo"}
                </span>
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllDiscovered}
                disabled={misconfigured || images.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-50 disabled:opacity-40"
              >
                <CheckSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                All discovered
              </button>
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={misconfigured || visibleImages.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-50 disabled:opacity-40"
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Visible only
              </button>
              <button
                type="button"
                onClick={fillSlotsByResolution}
                disabled={misconfigured}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-600 bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {workspaceMode ? "Fill free slots (largest first)" : "Pick best single (largest visible)"}
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Operations: batch &amp; single
              </Link>
            </div>
          </section>
        ) : null}

        <section className="mt-6 flex min-h-[min(52vh,28rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {images.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 p-8">
                <LayoutGrid className="mx-auto h-12 w-12 text-neutral-300" strokeWidth={1.25} />
              </div>
              <div className="max-w-md">
                <p className="text-sm font-semibold text-black">Ready when you are</p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  After you scan, every image we find appears below. Use <strong className="text-neutral-800">Maximum output</strong>{" "}
                  to select by capacity, then import — Operations handles one polished photo or a full batch run.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-5">
                <p className="text-sm text-neutral-800">
                  <span className="font-semibold text-black">{selected.size}</span>
                  <span className="text-neutral-500">
                    {" "}
                    selected · {visibleImages.length} visible
                    {visibleImages.length !== images.length ? (
                      <span className="text-neutral-400"> ({images.length} total)</span>
                    ) : null}
                  </span>
                  {workspaceMode ? (
                    <span className="ml-2 text-xs text-neutral-500">
                      · {slotsLeft.toLocaleString()} free slot{slotsLeft === 1 ? "" : "s"}
                      {WORKSPACE_UI_SHOW_SLASH_TOTAL ? ` (max ${MAX_WORKSPACE_ASSETS})` : ""}
                    </span>
                  ) : null}
                  {images.length > 0 ? (
                    <span className="mt-0.5 block text-[10px] text-neutral-400 sm:inline sm:mt-0 sm:ml-2">
                      Sized {sizedCount}/{images.length}
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-neutral-400 sm:inline">
                    Grid
                  </span>
                  <button
                    type="button"
                    onClick={() => setThumbSize("comfortable")}
                    className={`rounded-lg border p-2 transition-colors ${
                      thumbSize === "comfortable"
                        ? "border-black bg-neutral-100 text-black"
                        : "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                    }`}
                    title="Larger thumbnails"
                    aria-pressed={thumbSize === "comfortable"}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setThumbSize("compact")}
                    className={`rounded-lg border p-2 transition-colors ${
                      thumbSize === "compact"
                        ? "border-black bg-neutral-100 text-black"
                        : "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                    }`}
                    title="More columns"
                    aria-pressed={thumbSize === "compact"}
                  >
                    <Rows3 className="h-4 w-4" />
                  </button>
                  <span className="mx-1 hidden h-4 w-px bg-neutral-200 sm:block" aria-hidden />
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    All
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    <Square className="h-3.5 w-3.5" />
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleImport()}
                    disabled={importing || selected.size === 0 || misconfigured}
                    className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:text-sm"
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    {importPrimaryLabel}
                  </button>
                </div>
              </div>

              <div className="border-b border-neutral-100 bg-neutral-50/90">
                <button
                  type="button"
                  onClick={() => setFilterPanelOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left sm:px-5"
                >
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                    <SlidersHorizontal className="h-4 w-4 text-neutral-500" aria-hidden />
                    Filter by size &amp; shape
                    {dimFilterActive ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-amber-900">
                        Active
                      </span>
                    ) : null}
                  </span>
                  {filterPanelOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  )}
                </button>
                {filterPanelOpen ? (
                  <div className="space-y-3 px-4 pb-4 pt-0 sm:px-5">
                    <p className="text-[11px] leading-relaxed text-neutral-600">
                      Sizes come from thumbnails as they load in your browser (not the server). Turn on filters to
                      drop tiny icons or focus on large hero shots.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDimFilter(defaultImageDimFilter())}
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                      >
                        Reset filters
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDimFilter({
                            ...defaultImageDimFilter(),
                            minShortSide: 800,
                          })
                        }
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                      >
                        Hero (short side ≥ 800px)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDimFilter({
                            ...defaultImageDimFilter(),
                            minShortSide: 400,
                          })
                        }
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                      >
                        Web (short ≥ 400px)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDimFilter({
                            ...defaultImageDimFilter(),
                            maxShortSide: 200,
                          })
                        }
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                      >
                        Small / icons (short ≤ 200px)
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Min width (px)
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={dimFilter.minWidth || ""}
                          onChange={(e) =>
                            setDimFilter((p) => ({
                              ...p,
                              minWidth: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900"
                          placeholder="0 = any"
                        />
                      </label>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Min height (px)
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={dimFilter.minHeight || ""}
                          onChange={(e) =>
                            setDimFilter((p) => ({
                              ...p,
                              minHeight: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900"
                          placeholder="0 = any"
                        />
                      </label>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Min short side (px)
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={dimFilter.minShortSide || ""}
                          onChange={(e) =>
                            setDimFilter((p) => ({
                              ...p,
                              minShortSide: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900"
                          placeholder="0 = any"
                        />
                      </label>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Max short side (px)
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={dimFilter.maxShortSide || ""}
                          onChange={(e) =>
                            setDimFilter((p) => ({
                              ...p,
                              maxShortSide: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900"
                          placeholder="0 = any"
                        />
                      </label>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Min megapixels
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          inputMode="decimal"
                          value={dimFilter.minMegapixels || ""}
                          onChange={(e) =>
                            setDimFilter((p) => ({
                              ...p,
                              minMegapixels:
                                e.target.value === "" ? 0 : Math.max(0, parseFloat(e.target.value) || 0),
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900"
                          placeholder="0 = any"
                        />
                      </label>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Aspect
                        <select
                          value={dimFilter.aspect}
                          onChange={(e) =>
                            setDimFilter((p) => ({
                              ...p,
                              aspect: e.target.value as ImageDimFilter["aspect"],
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900"
                        >
                          <option value="any">Any</option>
                          <option value="landscape">Landscape</option>
                          <option value="portrait">Portrait</option>
                          <option value="square">Square (~1:1)</option>
                        </select>
                      </label>
                    </div>
                    <label className="flex cursor-pointer items-start gap-2 text-xs text-neutral-700">
                      <input
                        type="checkbox"
                        checked={hideUnsizedWhenFiltering}
                        onChange={(e) => setHideUnsizedWhenFiltering(e.target.checked)}
                        disabled={!dimFilterActive}
                        className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400 disabled:opacity-40"
                      />
                      <span>
                        <span className="font-medium text-neutral-900">Hide not-yet-sized</span> when a size filter
                        is on (grid stays empty until thumbnails finish loading).
                      </span>
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8 pt-4 sm:px-5">
                {visibleImages.length === 0 && images.length > 0 ? (
                  <p className="py-12 text-center text-sm text-neutral-600">
                    No images match these filters. Loosen min sizes or reset — {sizedCount} of {images.length} have
                    loaded dimensions so far.
                  </p>
                ) : (
                  <ul
                    className="grid gap-2 sm:gap-3"
                    style={{
                      gridTemplateColumns: `repeat(auto-fill, ${gridMin})`,
                    }}
                  >
                    {visibleImages.map((img) => {
                      const on = selected.has(img.url);
                      const dim = dimensionsByUrl[img.url];
                      const dimLabel =
                        dim && dim !== "error" ? `${dim.w}×${dim.h}` : dim === "error" ? "Failed" : "…";
                      return (
                        <li key={img.url} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleOne(img.url)}
                            className={`group w-full overflow-hidden rounded-xl border text-left shadow-sm transition-all ${
                              on
                                ? "border-black ring-2 ring-black ring-offset-2 ring-offset-white"
                                : "border-neutral-200 hover:border-neutral-400 hover:shadow-md"
                            }`}
                          >
                            <div
                              className={`relative bg-neutral-100 ${
                                thumbSize === "comfortable" ? "aspect-square" : "aspect-[4/3]"
                              }`}
                            >
                              <img
                                src={img.url}
                                alt={img.alt || ""}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onLoad={(e) => onThumbLoad(img.url, e.currentTarget)}
                                onError={() => {
                                  onThumbError(img.url);
                                }}
                              />
                              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                {img.source}
                              </span>
                              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 py-0.5 font-mono text-[9px] text-white">
                                {dimLabel}
                              </span>
                              {on && (
                                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-md">
                                  <CheckSquare className="h-3.5 w-3.5" strokeWidth={2.5} />
                                </span>
                              )}
                            </div>
                            <p
                              className={`line-clamp-2 break-all px-2 py-1.5 font-mono text-neutral-500 ${
                                thumbSize === "comfortable" ? "text-[10px]" : "text-[9px]"
                              }`}
                            >
                              {img.url}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-neutral-600">
                    <strong className="text-black">{selected.size}</strong> selected
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleImport()}
                    disabled={importing || selected.size === 0 || misconfigured}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {importPrimaryLabel}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <footer className="mt-6 text-[11px] leading-relaxed text-neutral-500">
          You need rights to use imported images. The API blocks private-network URLs. Discovery runs on the server (
          Zyte when configured, otherwise plain fetch). After import, Operations supports{" "}
          <strong className="text-neutral-600">batch</strong> jobs across the queue and{" "}
          <strong className="text-neutral-600">single</strong>-image runs. Keys:{" "}
          <Link to="/settings" className="font-medium text-neutral-700 underline underline-offset-2 hover:text-black">
            Integrations
          </Link>
          .
        </footer>
          </>
        )}
      </main>
    </div>
  );
}

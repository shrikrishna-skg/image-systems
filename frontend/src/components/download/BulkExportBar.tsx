import { Loader2, Package, FileArchive } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import JSZip from "jszip";
import client from "../../api/client";
import { suggestFilename } from "../../api/images";
import { getLocalBlob } from "../../lib/localImageStore";
import {
  DOWNLOAD_FORMAT_OPTIONS,
  DOWNLOAD_SIZE_OPTIONS,
  EXPORT_NAMING_PRESET_OPTIONS,
  appendSizeToFilename,
  buildBulkSeriesStem,
  buildExportStem,
  defaultBulkZipArchiveStem,
  exportDownloadBlob,
  makeUniqueZipEntryName,
  sanitizeZipArchiveBasename,
  type DownloadFormatId,
  type DownloadMaxEdgeId,
  type ExportNamingPresetId,
} from "../../lib/downloadExport";
import { getLatestImageVersion } from "../../lib/imageVersions";
import { isStorageOnlyMode } from "../../lib/storageOnlyMode";
import type { ImageInfo, ImageVersion } from "../../types";
import { toast } from "sonner";

type BulkStemMode = "rules" | "series";

interface Props {
  images: ImageInfo[];
  aiNamingProviders?: ("openai" | "gemini")[];
}

function latestVersion(versions: ImageVersion[] | undefined): ImageVersion | null {
  return getLatestImageVersion(versions) ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BulkExportBar({ images, aiNamingProviders = [] }: Props) {
  const storageOnly = isStorageOnlyMode();
  const targets = useMemo(
    () => images.filter((img) => latestVersion(img.versions)),
    [images]
  );

  const [exportFormat, setExportFormat] = useState<DownloadFormatId>("png_lossless");
  const [maxEdge, setMaxEdge] = useState<DownloadMaxEdgeId>("full");
  const [stemMode, setStemMode] = useState<BulkStemMode>("rules");
  const [namingPreset, setNamingPreset] = useState<ExportNamingPresetId>("pipeline");
  const [customBase, setCustomBase] = useState("");
  const [seriesPrefix, setSeriesPrefix] = useState("listing-set");
  const [perImageAi, setPerImageAi] = useState<Record<string, string>>({});
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">(
    aiNamingProviders.includes("gemini") ? "gemini" : "openai"
  );
  const [busy, setBusy] = useState(false);
  const [aiAllBusy, setAiAllBusy] = useState(false);
  const [zipArchiveStem, setZipArchiveStem] = useState("");
  const [autoAiNamesBeforeZip, setAutoAiNamesBeforeZip] = useState(true);
  const [aiZipNameBusy, setAiZipNameBusy] = useState(false);
  /** Skip re-calling suggest for the same (image, version) after success or terminal failure. */
  const autoAiFetchedVersionRef = useRef<Record<string, string>>({});

  const canAi = !storageOnly && aiNamingProviders.length > 0;

  const bulkAiSyncKey = useMemo(
    () =>
      targets
        .map((t) => {
          const v = latestVersion(t.versions);
          return `${t.id}:${v?.id ?? ""}`;
        })
        .join("|"),
    [targets]
  );

  useEffect(() => {
    if (maxEdge !== "full") {
      setExportFormat((f) => (f === "as_stored" ? "png_lossless" : f));
    }
  }, [maxEdge]);

  useEffect(() => {
    if (!aiNamingProviders.includes(aiProvider) && aiNamingProviders.length) {
      setAiProvider(aiNamingProviders.includes("gemini") ? "gemini" : "openai");
    }
  }, [aiNamingProviders, aiProvider]);

  useEffect(() => {
    autoAiFetchedVersionRef.current = {};
  }, [aiProvider]);

  /** Prefill per-file AI bases in the background (no toasts). */
  useEffect(() => {
    if (!canAi || stemMode !== "rules" || targets.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const img of targets) {
        if (cancelled) return;
        const v = latestVersion(img.versions);
        if (!v) continue;
        if (autoAiFetchedVersionRef.current[img.id] === v.id) continue;
        try {
          const data = await suggestFilename(img.id, { version: v.id, provider: aiProvider });
          if (cancelled) return;
          autoAiFetchedVersionRef.current = { ...autoAiFetchedVersionRef.current, [img.id]: v.id };
          setPerImageAi((prev) => {
            if (prev[img.id]) return prev;
            return { ...prev, [img.id]: data.basename };
          });
        } catch {
          if (!cancelled) {
            autoAiFetchedVersionRef.current = { ...autoAiFetchedVersionRef.current, [img.id]: v.id };
          }
        }
        await sleep(120);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAi, stemMode, aiProvider, bulkAiSyncKey, targets]);

  const stemForIndexWithMap = useCallback(
    (img: ImageInfo, index1: number, aiMap: Record<string, string>): string => {
      const v = latestVersion(img.versions)!;
      if (stemMode === "series") {
        return buildBulkSeriesStem(seriesPrefix, index1);
      }
      const raw = aiMap[img.id];
      const aiBase = raw?.trim() ? raw.trim() : null;
      return buildExportStem({
        preset: namingPreset,
        customBase,
        aiBase,
        originalFilename: img.original_filename,
        kind: "version",
        versionType: v.version_type,
        width: v.width,
        height: v.height,
      });
    },
    [stemMode, seriesPrefix, namingPreset, customBase]
  );

  if (targets.length < 2) return null;

  const triggerBrowserDownload = (blob: Blob, filename: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const prepareExportFile = async (
    imageId: string,
    versionId: string,
    stem: string
  ): Promise<{ blob: Blob; filename: string }> => {
    let blob: Blob;
    if (storageOnly) {
      const b = await getLocalBlob(imageId, versionId);
      if (!b) throw new Error("Not found");
      blob = b;
    } else {
      const res = await client.get(`/images/${imageId}/download?version=${versionId}`, {
        responseType: "blob",
      });
      blob = res.data;
    }
    const { blob: out, extension } = await exportDownloadBlob(blob, exportFormat, maxEdge);
    const filename = appendSizeToFilename(stem, maxEdge, extension);
    return { blob: out, filename };
  };

  const stemForIndex = (img: ImageInfo, index1: number) => stemForIndexWithMap(img, index1, perImageAi);

  const handleDownloadAll = async () => {
    setBusy(true);
    try {
      let aiMap: Record<string, string> = { ...perImageAi };

      let renameCostSum = 0;
      if (autoAiNamesBeforeZip && canAi) {
        for (const img of targets) {
          const v = latestVersion(img.versions)!;
          try {
            const data = await suggestFilename(img.id, { version: v.id, provider: aiProvider });
            aiMap = { ...aiMap, [img.id]: data.basename };
            if (data.estimated_cost_usd != null) renameCostSum += data.estimated_cost_usd;
          } catch {
            toast.error("AI name skipped", { description: img.original_filename, duration: 3500 });
          }
          await sleep(120);
        }
        setPerImageAi(aiMap);
      }

      const entries: { filename: string; blob: Blob }[] = [];
      for (let i = 0; i < targets.length; i++) {
        const img = targets[i];
        const v = latestVersion(img.versions)!;
        const stem = stemForIndexWithMap(img, i + 1, aiMap);
        const prep = await prepareExportFile(img.id, v.id, stem);
        entries.push(prep);
      }

      const zip = new JSZip();
      const used = new Set<string>();
      for (const e of entries) {
        const name = makeUniqueZipEntryName(used, e.filename);
        zip.file(name, e.blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const archiveBase = sanitizeZipArchiveBasename(zipArchiveStem.trim() || defaultBulkZipArchiveStem());
      const zipFileName = `${archiveBase}.zip`;
      triggerBrowserDownload(zipBlob, zipFileName);
      toast.success("ZIP download started", {
        description: `${entries.length} images in ${zipFileName}${
          autoAiNamesBeforeZip && renameCostSum > 0
            ? ` · ~$${renameCostSum.toFixed(5)} USD est. total for AI renames (Google list rates; not a bill)`
            : ""
        }`,
        duration: 5500,
      });
    } catch {
      toast.error("Bulk download failed", {
        description: "Try another format, fewer images, or download individually from each row.",
        duration: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAiNameAll = async () => {
    if (!canAi) return;
    setAiAllBusy(true);
    const next: Record<string, string> = { ...perImageAi };
    try {
      for (const img of targets) {
        const v = latestVersion(img.versions)!;
        try {
          const data = await suggestFilename(img.id, { version: v.id, provider: aiProvider });
          next[img.id] = data.basename;
          autoAiFetchedVersionRef.current = { ...autoAiFetchedVersionRef.current, [img.id]: v.id };
          setPerImageAi({ ...next });
        } catch {
          toast.error("AI name failed", { description: img.original_filename, duration: 4000 });
        }
        await sleep(200);
      }
      toast.success("AI names applied", {
        description: "Review or edit each base below, then Download ZIP.",
        duration: 4000,
      });
    } finally {
      setAiAllBusy(false);
    }
  };

  const handleAiZipArchiveName = async () => {
    if (!canAi || targets.length === 0) return;
    setAiZipNameBusy(true);
    try {
      const img = targets[0];
      const v = latestVersion(img.versions)!;
      const data = await suggestFilename(img.id, { version: v.id, provider: aiProvider });
      setZipArchiveStem(`${data.basename}-bulk`);
      toast.success("ZIP archive name suggested", {
        description: "Uses the first asset in the list; edit the field before downloading.",
        duration: 4500,
      });
    } catch {
      toast.error("Could not suggest ZIP name", {
        description: "Set the archive name manually or check your API key.",
        duration: 5000,
      });
    } finally {
      setAiZipNameBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-black" />
        Bulk export ({targets.length} assets)
      </h3>
      <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
        Downloads the <strong className="text-black">latest result</strong> for each workspace image. When you
        export <strong className="text-black">two or more</strong> assets, files are bundled into{" "}
        <strong className="text-black">one .zip</strong> using the names below. AI rename defaults to{" "}
        <strong className="text-black">Gemini 2.5 Flash-Lite</strong> (cheap multimodal) and uses image + metadata;
        the app shows a <strong className="text-black">per-call cost estimate</strong> (list pricing, not an invoice).
      </p>

      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 mb-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
          <FileArchive className="h-4 w-4" aria-hidden />
          ZIP archive ({targets.length} files)
        </p>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
            Archive name (no .zip)
          </span>
          <input
            type="text"
            value={zipArchiveStem}
            onChange={(e) => setZipArchiveStem(e.target.value)}
            placeholder={defaultBulkZipArchiveStem()}
            className="mt-1.5 w-full rounded-lg border border-emerald-200/90 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-emerald-300 font-data"
          />
          <span className="mt-1 block text-[11px] text-neutral-600">
            Saved as <span className="font-mono">{sanitizeZipArchiveBasename(zipArchiveStem.trim() || defaultBulkZipArchiveStem())}.zip</span>
          </span>
        </label>
        {canAi && (
          <button
            type="button"
            onClick={() => void handleAiZipArchiveName()}
            disabled={aiZipNameBusy}
            className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-50 disabled:opacity-50"
          >
            {aiZipNameBusy ? "Suggesting…" : "Suggest ZIP name (AI, from first asset)"}
          </button>
        )}
        {canAi && (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={autoAiNamesBeforeZip}
              onChange={(e) => setAutoAiNamesBeforeZip(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-neutral-300"
            />
            <span>
              <strong className="text-black">Auto AI-name every file</strong> before building the ZIP (on by
              default; uses the provider above — one API call per image). Turn off to use templates only and save
              time.
            </span>
          </label>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            File format
          </span>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as DownloadFormatId)}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300"
          >
            {DOWNLOAD_FORMAT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} disabled={o.id === "as_stored" && maxEdge !== "full"}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Max long edge
          </span>
          <select
            value={maxEdge}
            onChange={(e) => setMaxEdge(e.target.value as DownloadMaxEdgeId)}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300"
          >
            {DOWNLOAD_SIZE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 mb-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Bulk naming</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bulkStem"
              checked={stemMode === "rules"}
              onChange={() => setStemMode("rules")}
              className="rounded-full border-neutral-300"
            />
            <span className="text-black">Per asset (preset / AI)</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bulkStem"
              checked={stemMode === "series"}
              onChange={() => setStemMode("series")}
              className="rounded-full border-neutral-300"
            />
            <span className="text-black">Series numbers</span>
          </label>
        </div>

        {stemMode === "series" ? (
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Series prefix
            </span>
            <input
              type="text"
              value={seriesPrefix}
              onChange={(e) => setSeriesPrefix(e.target.value)}
              placeholder="listing-set"
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 font-data"
            />
            <span className="mt-1 block text-[11px] text-neutral-500">
              Files: prefix-001, prefix-002, …
            </span>
          </label>
        ) : (
          <>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Auto template
              </span>
              <select
                value={namingPreset}
                onChange={(e) => setNamingPreset(e.target.value as ExportNamingPresetId)}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300"
              >
                {EXPORT_NAMING_PRESET_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {namingPreset === "custom" && (
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Custom base
                </span>
                <input
                  type="text"
                  value={customBase}
                  onChange={(e) => setCustomBase(e.target.value)}
                  placeholder="property-west-wing"
                  className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300 font-data"
                />
              </label>
            )}
            {canAi && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end pt-1">
                <label className="block flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    AI provider
                  </span>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as "openai" | "gemini")}
                    className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-neutral-300"
                  >
                    {aiNamingProviders.includes("openai") && <option value="openai">OpenAI</option>}
                    {aiNamingProviders.includes("gemini") && <option value="gemini">Gemini</option>}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void handleAiNameAll()}
                  disabled={aiAllBusy}
                  className="shrink-0 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-50 disabled:opacity-50"
                >
                  {aiAllBusy ? "Naming…" : "AI suggest each"}
                </button>
              </div>
            )}
            {!canAi && (
              <p className="text-[11px] text-neutral-500">
                AI naming needs a saved OpenAI or Gemini key (Settings). In local-only mode, use templates or
                series numbers.
              </p>
            )}
          </>
        )}

        <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold text-black">Per file — rename &amp; preview</p>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Each row shows the download filename stem (before format / max-size suffix). With{" "}
            <strong className="text-black">Per asset</strong>, AI bases fill in automatically when keys are
            configured; edit or use <strong className="text-black">AI suggest each</strong> to refresh. With{" "}
            <strong className="text-black">Series numbers</strong>, stems are prefix-001, …
          </p>
          <ul className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {targets.map((img, i) => {
              const idx = i + 1;
              const stem = stemForIndex(img, idx);
              return (
                <li
                  key={img.id}
                  className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-2.5 space-y-1.5"
                >
                  <p className="text-[11px] text-neutral-600 truncate" title={img.original_filename}>
                    {img.original_filename}
                  </p>
                  {stemMode === "rules" ? (
                    <input
                      type="text"
                      value={perImageAi[img.id] ?? ""}
                      onChange={(e) =>
                        setPerImageAi((prev) => ({
                          ...prev,
                          [img.id]: e.target.value,
                        }))
                      }
                      placeholder="Optional base (or use AI suggest each)"
                      className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs text-black font-data outline-none focus:ring-2 focus:ring-neutral-300"
                    />
                  ) : null}
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Download stem
                  </p>
                  <p className="text-xs font-data text-black break-all">{stem}</p>
                </li>
              );
            })}
          </ul>
          {stemMode === "rules" && Object.keys(perImageAi).length > 0 && (
            <button
              type="button"
              onClick={() => {
              autoAiFetchedVersionRef.current = {};
              setPerImageAi({});
            }}
              className="text-xs font-semibold text-black underline decoration-neutral-400 underline-offset-2 hover:decoration-black"
            >
              Clear all per-file bases
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleDownloadAll()}
        disabled={busy}
        className="w-full sm:w-auto min-w-[220px] flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {autoAiNamesBeforeZip ? "Naming & zipping…" : "Zipping…"}
          </>
        ) : (
          <>
            <FileArchive className="h-5 w-5" strokeWidth={2} />
            Download ZIP ({targets.length} images)
          </>
        )}
      </button>
    </div>
  );
}
